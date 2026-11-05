<?php

namespace App\Http\Controllers;

use App\Models\LoyaltyCard;
use App\Models\LoyaltyPointsTransaction;
use App\Models\Offer;
use App\Services\Sales\SalesInquiryService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class CustomerMeController extends Controller
{
    public function __construct(private SalesInquiryService $inquiry) {}

    /** The logged-in customer's own profile. */
    public function profile(Request $request)
    {
        return response()->json($request->user()->load('loyaltyCard.tier'));
    }

    public function updateProfile(Request $request)
    {
        $customer = $request->user();

        $data = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|nullable|email|max:255|unique:debtors_master,email,' . $customer->debtor_no . ',debtor_no',
            'address' => 'sometimes|nullable|string|max:255',
            'date_of_birth' => 'sometimes|nullable|date',
        ]);

        $customer->update($data);

        return response()->json($customer);
    }

    /** Change password while logged in (distinct from the forgot-password flow). */
    public function changePassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => 'required|string',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $customer = $request->user();

        if (! $customer->password || ! Hash::check($data['current_password'], $customer->password)) {
            throw ValidationException::withMessages([
                'current_password' => ['Current password is incorrect.'],
            ]);
        }

        $customer->update(['password' => Hash::make($data['password'])]);

        return response()->json(['message' => 'Password updated.']);
    }

    /** Loyalty card + points balance + tier for the logged-in customer. */
    public function loyalty(Request $request)
    {
        $card = LoyaltyCard::with('tier')
            ->where('debtor_no', $request->user()->debtor_no)
            ->first();

        if (! $card) {
            return response()->json(['message' => 'No loyalty card found for this account.'], 404);
        }

        return response()->json([
            'card_no' => $card->card_no,
            'qr_payload' => $card->card_no, // client renders this as a QR code
            'points_balance' => $card->points_balance,
            'tier' => $card->tier,
            'status' => $card->status,
            'issue_date' => $card->issue_date,
        ]);
    }

    public function loyaltyHistory(Request $request)
    {
        $rows = LoyaltyPointsTransaction::where('debtor_no', $request->user()->debtor_no)
            ->orderByDesc('id')
            ->limit(200)
            ->get();

        return response()->json($rows);
    }

    /**
     * Offers applicable to the logged-in customer: tier-wide, customer-specific,
     * plus every active product/category offer (mobile shows those under
     * "Other Offers" since they're not tied to this customer specifically).
     * Delegates the matching rules to OfferController::applicable to avoid
     * duplicating that logic.
     */
    public function offers(Request $request, OfferController $offerController)
    {
        $today = now()->toDateString();
        $debtorNo = $request->user()->debtor_no;

        // Birthday / tier / personal offers are for loyalty customers only;
        // a normal (app) customer sees just the general offers.
        $isLoyalty = LoyaltyCard::where('debtor_no', $debtorNo)->where('status', 'active')->exists();
        $mine = $isLoyalty
            ? $offerController->applicable(Request::create('', 'GET', ['debtor_no' => $debtorNo]))->getData()
            : [];

        $general = Offer::where('status', 'active')
            ->whereIn('offer_type', ['product', 'category'])
            ->whereDate('valid_from', '<=', $today)
            ->whereDate('valid_to', '>=', $today)
            ->get();

        return response()->json([
            'for_you' => $mine,
            'other_offers' => $general,
        ]);
    }

    /** The logged-in customer's own purchase history. */
    public function purchases(Request $request)
    {
        $rows = $this->inquiry->customerTransactions([
            'debtor_no' => $request->user()->debtor_no,
            'from_date' => $request->query('from_date'),
            'to_date' => $request->query('to_date'),
            'limit' => $request->query('limit', 100),
        ]);

        return response()->json($rows);
    }

    /** A single receipt, but only if it belongs to the logged-in customer. */
    public function receipt(Request $request, string $transNo)
    {
        if (! Schema::hasTable('debtor_trans')) {
            return response()->json(['message' => 'Not available.'], 404);
        }

        $header = DB::table('debtor_trans')
            ->where('trans_no', $transNo)
            ->where('debtor_no', $request->user()->debtor_no)
            ->first();

        if (! $header) {
            return response()->json(['message' => 'Receipt not found.'], 404);
        }

        $lines = Schema::hasTable('debtor_trans_details')
            ? DB::table('debtor_trans_details')->where('debtor_trans_no', $transNo)->get()
            : [];

        return response()->json([
            'header' => $header,
            'lines' => $lines,
        ]);
    }

    /** Unread + recent notifications for the logged-in customer. */
    public function notifications(Request $request)
    {
        return response()->json(
            $request->user()->notifications()->orderByDesc('id')->limit(100)->get()
        );
    }

    public function markNotificationRead(Request $request, int $id)
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->update(['read_at' => now()]);

        return response()->json($notification);
    }
}
