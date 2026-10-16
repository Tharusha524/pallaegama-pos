<?php

namespace App\Http\Controllers;

use App\Models\Offer;
use App\Models\OfferRedemption;
use App\Models\LoyaltyCard;
use App\Models\DebtorsMaster;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class OfferController extends Controller
{
    public function index()
    {
        return response()->json(Offer::orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'offer_name' => 'required|string|max:150',
            'coupon_code' => 'nullable|string|max:50|unique:offers,coupon_code',
            'offer_type' => 'required|in:product,category,tier,customer,birthday',
            'target_id' => 'nullable|string',
            'discount_type' => 'required|in:percent,fixed',
            'discount_value' => 'required|numeric|min:0',
            'valid_from' => 'required|date',
            'valid_to' => 'required|date|after_or_equal:valid_from',
            'min_purchase_amount' => 'nullable|numeric|min:0',
            'max_total_uses' => 'nullable|integer|min:1',
            'max_uses_per_customer' => 'nullable|integer|min:1',
            'status' => 'in:active,inactive',
            'image' => 'nullable|image|max:5120',
        ]);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('offer_images', 'public');
        }
        unset($data['image']);

        return response()->json(Offer::create($data), 201);
    }

    public function show(string $id)
    {
        $offer = Offer::find($id);
        if (!$offer) {
            return response()->json(['message' => 'Offer not found'], 404);
        }
        return response()->json($offer);
    }

    public function update(Request $request, string $id)
    {
        $offer = Offer::find($id);
        if (!$offer) {
            return response()->json(['message' => 'Offer not found'], 404);
        }

        $data = $request->validate([
            'offer_name' => 'sometimes|required|string|max:150',
            'offer_type' => 'sometimes|required|in:product,category,tier,customer,birthday',
            'target_id' => 'nullable|string',
            'discount_type' => 'sometimes|required|in:percent,fixed',
            'discount_value' => 'sometimes|required|numeric|min:0',
            'valid_from' => 'sometimes|required|date',
            'valid_to' => 'sometimes|required|date|after_or_equal:valid_from',
            'min_purchase_amount' => 'nullable|numeric|min:0',
            'status' => 'in:active,inactive',
            'image' => 'nullable|image|max:5120',
        ]);

        if ($request->hasFile('image')) {
            if ($offer->image_path) {
                Storage::disk('public')->delete($offer->image_path);
            }
            $data['image_path'] = $request->file('image')->store('offer_images', 'public');
        } elseif ($request->boolean('remove_image')) {
            if ($offer->image_path) {
                Storage::disk('public')->delete($offer->image_path);
            }
            $data['image_path'] = null;
        }
        unset($data['image']);

        $offer->update($data);
        return response()->json($offer->fresh());
    }

    public function destroy(string $id)
    {
        $offer = Offer::find($id);
        if (!$offer) {
            return response()->json(['message' => 'Offer not found'], 404);
        }
        if ($offer->image_path) {
            Storage::disk('public')->delete($offer->image_path);
        }
        $offer->delete();
        return response()->json(['message' => 'Offer deleted']);
    }

    /** Public endpoint for the mobile app — returns only active offers with image URLs. */
    public function mobileOffers(Request $request)
    {
        $today = now()->toDateString();
        $offers = Offer::where('status', 'active')
            ->whereDate('valid_from', '<=', $today)
            ->whereDate('valid_to', '>=', $today)
            ->orderByDesc('id')
            ->get(['id', 'offer_name', 'offer_type', 'discount_type', 'discount_value', 'valid_from', 'valid_to', 'image_path']);

        return response()->json(['data' => $offers]);
    }

    /**
     * Resolve applicable active offers for a customer/product combination at checkout time.
     */
    public function applicable(Request $request)
    {
        $debtorNo = $request->query('debtor_no');
        $stockId = $request->query('stock_id');
        $categoryId = $request->query('category_id');
        $today = now()->toDateString();

        $query = Offer::where('status', 'active')
            ->whereDate('valid_from', '<=', $today)
            ->whereDate('valid_to', '>=', $today);

        $offers = $query->get()->filter(function ($offer) use ($debtorNo, $stockId, $categoryId) {
            return match ($offer->offer_type) {
                // A "product" offer's target_id may hold several stock_ids,
                // comma-separated (e.g. "1000,1500,FG010") — matches any one of them.
                'product' => $stockId && in_array($stockId, array_map('trim', explode(',', (string) $offer->target_id))),
                'category' => $categoryId && $offer->target_id == $categoryId,
                'customer' => $debtorNo && $offer->target_id == $debtorNo,
                'tier' => $debtorNo && $this->debtorTierMatches($debtorNo, $offer->target_id),
                // No target_id to check — just "is it this customer's
                // birthday today?" Automatically surfaces on checkout
                // instead of only the reminder chip, so the cashier doesn't
                // have to remember to apply it manually.
                'birthday' => $debtorNo && $this->isDebtorBirthdayToday($debtorNo),
                default => false,
            };
        })->values();

        return response()->json($offers);
    }

    private function isDebtorBirthdayToday($debtorNo): bool
    {
        $dob = DebtorsMaster::where('debtor_no', $debtorNo)->value('date_of_birth');
        if (!$dob) {
            return false;
        }
        $dob = \Carbon\Carbon::parse($dob);
        $today = now();
        return $dob->month === $today->month && $dob->day === $today->day;
    }

    private function debtorTierMatches($debtorNo, $tierId): bool
    {
        $card = LoyaltyCard::where('debtor_no', $debtorNo)->first();
        return $card && (string) $card->loyalty_tier_id === (string) $tierId;
    }

    /**
     * Record that an offer was used on a transaction (also called from SalesInvoiceController).
     * Increments the offer's usage counter — callers should check usage
     * limits via applyCoupon()/checkUsageLimits() before invoking this.
     */
    public static function recordRedemption(int $offerId, ?int $debtorNo, float $discountAmount, ?int $transNo = null, ?int $transType = null): OfferRedemption
    {
        Offer::where('id', $offerId)->increment('times_used');

        return OfferRedemption::create([
            'offer_id' => $offerId,
            'debtor_no' => $debtorNo,
            'debtor_trans_no' => $transNo,
            'debtor_trans_type' => $transType,
            'discount_amount' => $discountAmount,
            'redeemed_at' => now()->toDateString(),
        ]);
    }

    /**
     * Resolve a coupon code at checkout: validates it's active, in date,
     * and within its total/per-customer usage limits.
     */
    public function applyCoupon(Request $request)
    {
        $data = $request->validate([
            'coupon_code' => 'required|string',
            'debtor_no' => 'nullable|integer',
        ]);

        $offer = Offer::where('coupon_code', $data['coupon_code'])->first();
        if (!$offer) {
            return response()->json(['message' => 'Invalid coupon code'], 404);
        }

        $today = now()->toDateString();
        if ($offer->status !== 'active' || $offer->valid_from > $today || $offer->valid_to < $today) {
            return response()->json(['message' => 'This coupon is not currently valid'], 422);
        }
        if ($offer->max_total_uses && $offer->times_used >= $offer->max_total_uses) {
            return response()->json(['message' => 'This coupon has reached its usage limit'], 422);
        }
        if ($offer->max_uses_per_customer && !empty($data['debtor_no'])) {
            $usedByCustomer = OfferRedemption::where('offer_id', $offer->id)
                ->where('debtor_no', $data['debtor_no'])
                ->count();
            if ($usedByCustomer >= $offer->max_uses_per_customer) {
                return response()->json(['message' => 'You have already used this coupon the maximum number of times'], 422);
            }
        }

        return response()->json($offer);
    }

    /**
     * Confirm a coupon was actually used on a completed sale (called after
     * checkout succeeds) — increments its usage counters via recordRedemption.
     */
    public function confirmCouponUsage(Request $request)
    {
        $data = $request->validate([
            'coupon_code' => 'required|exists:offers,coupon_code',
            'debtor_no' => 'nullable|integer',
            'discount_amount' => 'required|numeric|min:0',
            'debtor_trans_no' => 'nullable|integer',
            'debtor_trans_type' => 'nullable|integer',
        ]);

        $offer = Offer::where('coupon_code', $data['coupon_code'])->firstOrFail();

        $redemption = self::recordRedemption(
            $offer->id,
            $data['debtor_no'] ?? null,
            $data['discount_amount'],
            $data['debtor_trans_no'] ?? null,
            $data['debtor_trans_type'] ?? null
        );

        return response()->json($redemption, 201);
    }

    /**
     * Popularity/effectiveness report: which offers were redeemed most
     * often, how much discount they cost, and — the actual "effective"
     * measure — how much real sale revenue those redemptions were attached
     * to (via each redemption's linked debtor_trans).
     */
    public function popularity()
    {
        $revenueByOffer = DB::table('offer_redemptions as r')
            ->join('debtor_trans as dt', function ($join) {
                $join->on('dt.trans_no', '=', 'r.debtor_trans_no')
                     ->on('dt.trans_type', '=', 'r.debtor_trans_type');
            })
            ->select('r.offer_id')
            ->selectRaw('SUM(dt.ov_amount) as total_revenue')
            ->groupBy('r.offer_id')
            ->pluck('total_revenue', 'offer_id');

        $rows = OfferRedemption::select('offer_id')
            ->selectRaw('COUNT(*) as redemption_count')
            ->selectRaw('SUM(discount_amount) as total_discount_given')
            ->with('offer:id,offer_name')
            ->groupBy('offer_id')
            ->orderByDesc('redemption_count')
            ->get()
            ->map(function ($row) use ($revenueByOffer) {
                $row->total_revenue = (float) ($revenueByOffer[$row->offer_id] ?? 0);

                return $row;
            });

        return response()->json($rows);
    }
}
