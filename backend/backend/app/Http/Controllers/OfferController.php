<?php

namespace App\Http\Controllers;

use App\Models\Offer;
use App\Models\OfferRedemption;
use App\Models\LoyaltyCard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

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
            'offer_type' => 'required|in:product,category,tier,customer',
            'target_id' => 'nullable|string',
            'discount_type' => 'required|in:percent,fixed',
            'discount_value' => 'required|numeric|min:0',
            'valid_from' => 'required|date',
            'valid_to' => 'required|date|after_or_equal:valid_from',
            'min_purchase_amount' => 'nullable|numeric|min:0',
            'max_total_uses' => 'nullable|integer|min:1',
            'max_uses_per_customer' => 'nullable|integer|min:1',
            'status' => 'in:active,inactive',
        ]);

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
            'offer_type' => 'sometimes|required|in:product,category,tier,customer',
            'target_id' => 'nullable|string',
            'discount_type' => 'sometimes|required|in:percent,fixed',
            'discount_value' => 'sometimes|required|numeric|min:0',
            'valid_from' => 'sometimes|required|date',
            'valid_to' => 'sometimes|required|date|after_or_equal:valid_from',
            'min_purchase_amount' => 'nullable|numeric|min:0',
            'status' => 'in:active,inactive',
        ]);

        $offer->update($data);
        return response()->json($offer);
    }

    public function destroy(string $id)
    {
        $offer = Offer::find($id);
        if (!$offer) {
            return response()->json(['message' => 'Offer not found'], 404);
        }
        $offer->delete();
        return response()->json(['message' => 'Offer deleted']);
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
                'product' => $stockId && $offer->target_id == $stockId,
                'category' => $categoryId && $offer->target_id == $categoryId,
                'customer' => $debtorNo && $offer->target_id == $debtorNo,
                'tier' => $debtorNo && $this->debtorTierMatches($debtorNo, $offer->target_id),
                default => false,
            };
        })->values();

        return response()->json($offers);
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
     * Popularity report: which offers were redeemed most often / most value.
     */
    public function popularity()
    {
        $rows = OfferRedemption::select('offer_id')
            ->selectRaw('COUNT(*) as redemption_count')
            ->selectRaw('SUM(discount_amount) as total_discount_given')
            ->with('offer:id,offer_name')
            ->groupBy('offer_id')
            ->orderByDesc('redemption_count')
            ->get();

        return response()->json($rows);
    }
}
