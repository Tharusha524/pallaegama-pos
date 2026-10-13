<?php

namespace App\Http\Controllers;

use App\Models\CompanySetup;
use App\Models\DebtorsMaster;
use App\Models\MobilePromotion;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class MobilePromotionController extends Controller
{
    private const MOBILE_FIELDS = [
        'id', 'title', 'description', 'promo_type', 'discount_type', 'discount_value',
        'valid_from', 'valid_to', 'image_path', 'sort_order',
    ];

    /** Admin list — every promotion, including expired/inactive. */
    public function index()
    {
        return response()->json(
            MobilePromotion::orderBy('sort_order')->orderByDesc('id')->get()
        );
    }

    public function store(Request $request)
    {
        $data = $this->validated($request);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('mobile_promotions', 'public');
        }

        return response()->json(MobilePromotion::create($data), 201);
    }

    /** POST (not PUT) so multipart image uploads work — PHP doesn't parse multipart PUT bodies. */
    public function update(Request $request, int $id)
    {
        $promotion = MobilePromotion::findOrFail($id);
        $data = $this->validated($request);

        if ($request->hasFile('image')) {
            $this->deleteImage($promotion->image_path);
            $data['image_path'] = $request->file('image')->store('mobile_promotions', 'public');
        } elseif ($request->boolean('remove_image')) {
            $this->deleteImage($promotion->image_path);
            $data['image_path'] = null;
        }

        $promotion->update($data);

        return response()->json($promotion->fresh());
    }

    public function destroy(int $id)
    {
        $promotion = MobilePromotion::findOrFail($id);
        $this->deleteImage($promotion->image_path);
        $promotion->delete();

        return response()->json(['message' => 'Deleted successfully']);
    }

    /** Public — for the customer mobile app; only promotions active today. */
    public function mobileIndex(Request $request)
    {
        $query = MobilePromotion::currentlyActive()
            ->orderBy('sort_order')
            ->orderByDesc('id');

        if ($request->filled('type')) {
            $query->where('promo_type', $request->query('type'));
        }

        return response()->json([
            'data' => $query->get(self::MOBILE_FIELDS),
        ]);
    }

    /** Public — single active promotion for the mobile app's detail screen. */
    public function mobileShow(int $id)
    {
        $promotion = MobilePromotion::currentlyActive()->find($id, self::MOBILE_FIELDS);

        if (!$promotion) {
            return response()->json(['message' => 'Promotion not found or expired'], 404);
        }

        return response()->json(['data' => $promotion]);
    }

    /**
     * Optional SMS broadcast of a promotion to every active customer with a
     * mobile number, via the same Notify.lk gateway as win-back campaigns.
     */
    public function sendSms(Request $request, int $id)
    {
        $promotion = MobilePromotion::findOrFail($id);
        $data = $request->validate(['message' => 'nullable|string|max:480']);

        $userId = config('services.notifylk.user_id');
        $apiKey = config('services.notifylk.api_key');
        $senderId = config('services.notifylk.sender_id');

        if (empty($userId) || empty($apiKey)) {
            return response()->json(['message' => 'Notify.lk credentials not configured in .env'], 422);
        }

        $message = $data['message'] ?? $this->buildMessage($promotion);

        $mobiles = DebtorsMaster::query()
            ->where(fn ($q) => $q->where('inactive', false)->orWhereNull('inactive'))
            ->whereNotNull('mobile')
            ->where('mobile', '!=', '')
            ->pluck('mobile')
            ->map(fn ($m) => $this->toSriLankanInternationalFormat($m))
            ->filter(fn ($m) => strlen($m) === 11)
            ->unique()
            ->values();

        if ($mobiles->isEmpty()) {
            return response()->json(['message' => 'No customers with a mobile number found'], 422);
        }

        set_time_limit(0);
        $sent = 0;
        $failed = 0;

        foreach ($mobiles as $to) {
            try {
                $response = Http::timeout(15)->get('https://app.notify.lk/api/v1/send', [
                    'user_id' => $userId,
                    'api_key' => $apiKey,
                    'sender_id' => $senderId,
                    'to' => $to,
                    'message' => $message,
                ]);
                if ($response->successful() && ($response->json('status') === 'success')) {
                    $sent++;
                } else {
                    $failed++;
                    Log::warning('Promotion SMS failed', ['promotion_id' => $id, 'to' => $to, 'response' => $response->json()]);
                }
            } catch (\Throwable $e) {
                $failed++;
                Log::error('Promotion SMS threw an exception', ['promotion_id' => $id, 'to' => $to, 'error' => $e->getMessage()]);
            }
        }

        $promotion->update([
            'sms_sent_at' => now(),
            'sms_sent_count' => $promotion->sms_sent_count + $sent,
        ]);

        return response()->json([
            'sent' => $sent,
            'failed' => $failed,
            'total' => $mobiles->count(),
            'promotion' => $promotion->fresh(),
        ]);
    }

    /** Number of customers a broadcast would reach — shown before confirming. */
    public function smsRecipientCount()
    {
        $count = DebtorsMaster::query()
            ->where(fn ($q) => $q->where('inactive', false)->orWhereNull('inactive'))
            ->whereNotNull('mobile')
            ->where('mobile', '!=', '')
            ->count();

        return response()->json(['count' => $count]);
    }

    private function validated(Request $request): array
    {
        $data = $request->validate([
            'title' => 'required|string|max:255',
            'description' => 'nullable|string|max:2000',
            'promo_type' => 'required|in:promotion,offer,discount',
            'discount_type' => 'nullable|in:percent,fixed',
            'discount_value' => 'nullable|numeric|min:0',
            'valid_from' => 'required|date',
            'valid_to' => 'required|date|after_or_equal:valid_from',
            'is_active' => 'nullable|boolean',
            'sort_order' => 'nullable|integer|min:0',
            'image' => 'nullable|image|max:5120',
        ]);

        unset($data['image']);
        $data['is_active'] = $request->boolean('is_active', true);
        $data['sort_order'] = (int) ($data['sort_order'] ?? 0);

        if (empty($data['discount_type'])) {
            $data['discount_type'] = null;
            $data['discount_value'] = null;
        }

        return $data;
    }

    private function deleteImage(?string $path): void
    {
        if ($path && Storage::disk('public')->exists($path)) {
            Storage::disk('public')->delete($path);
        }
    }

    private function buildMessage(MobilePromotion $promotion): string
    {
        $shop = CompanySetup::query()->value('name') ?: 'our store';
        $parts = [$promotion->title];

        if ($promotion->discount_type && $promotion->discount_value) {
            $value = rtrim(rtrim(number_format($promotion->discount_value, 2, '.', ''), '0'), '.');
            $parts[] = $promotion->discount_type === 'percent' ? "{$value}% OFF" : "Rs.{$value} OFF";
        }

        $parts[] = 'Valid till ' . $promotion->valid_to->format('d M Y');

        return implode(' - ', $parts) . ". Visit {$shop}!";
    }

    private function toSriLankanInternationalFormat(string $mobile): string
    {
        $digits = preg_replace('/\D+/', '', $mobile);

        if (str_starts_with($digits, '94')) {
            return $digits;
        }
        if (str_starts_with($digits, '0')) {
            return '94' . substr($digits, 1);
        }

        return '94' . $digits;
    }
}
