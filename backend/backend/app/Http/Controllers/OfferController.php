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
            'offer_type' => 'required|in:product,category,tier,customer',
            'target_id' => 'nullable|string',
            'discount_type' => 'required|in:percent,fixed',
            'discount_value' => 'required|numeric|min:0',
            'valid_from' => 'required|date',
            'valid_to' => 'required|date|after_or_equal:valid_from',
            'min_purchase_amount' => 'nullable|numeric|min:0',
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
     */
    public static function recordRedemption(int $offerId, ?int $debtorNo, float $discountAmount, ?int $transNo = null, ?int $transType = null): OfferRedemption
    {
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
