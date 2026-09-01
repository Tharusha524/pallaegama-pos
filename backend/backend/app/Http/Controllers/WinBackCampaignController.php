<?php

namespace App\Http\Controllers;

use App\Models\DebtorsMaster;
use App\Models\WinBackCampaign;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WinBackCampaignController extends Controller
{
    /**
     * Customers who have not purchased in the given number of days.
     */
    public function inactiveCustomers(Request $request)
    {
        $days = (int) $request->query('days', 30);
        $cutoff = now()->subDays($days)->toDateString();

        $customers = DebtorsMaster::where('inactive', false)
            ->where(function ($q) use ($cutoff) {
                $q->whereNull('last_purchase_date')
                  ->orWhereDate('last_purchase_date', '<=', $cutoff);
            })
            ->orderBy('last_purchase_date')
            ->get(['debtor_no', 'name', 'mobile', 'email', 'last_purchase_date']);

        return response()->json($customers);
    }

    /**
     * Send (log) a win-back offer to a customer via SMS/WhatsApp.
     * NOTE: no SMS/WhatsApp provider is currently integrated — this records the
     * campaign and logs the intended message. Wire a real gateway (e.g. Twilio,
     * a local SMS gateway) into sendMessage() below when one is available.
     */
    public function send(Request $request)
    {
        $data = $request->validate([
            'debtor_no' => 'required|exists:debtors_master,debtor_no',
            'offer_id' => 'nullable|exists:offers,id',
            'channel' => 'required|in:sms,whatsapp',
            'message' => 'nullable|string',
        ]);

        $customer = DebtorsMaster::find($data['debtor_no']);

        $this->sendMessage($customer, $data['channel'], $data['message'] ?? 'A special offer for you!');

        $campaign = WinBackCampaign::create([
            'debtor_no' => $data['debtor_no'],
            'offer_id' => $data['offer_id'] ?? null,
            'channel' => $data['channel'],
            'sent_at' => now(),
            'redeemed' => false,
        ]);

        return response()->json($campaign, 201);
    }

    public function history(Request $request)
    {
        $query = WinBackCampaign::with(['debtor:debtor_no,name,mobile', 'offer:id,offer_name'])
            ->orderByDesc('sent_at');

        if ($request->filled('debtor_no')) {
            $query->where('debtor_no', $request->query('debtor_no'));
        }

        return response()->json($query->get());
    }

    public function markRedeemed(string $id)
    {
        $campaign = WinBackCampaign::find($id);
        if (!$campaign) {
            return response()->json(['message' => 'Campaign not found'], 404);
        }
        $campaign->update(['redeemed' => true]);
        return response()->json($campaign);
    }

    private function sendMessage(?DebtorsMaster $customer, string $channel, string $message): void
    {
        // Stub: no SMS/WhatsApp gateway integrated yet. Logged for now.
        Log::info('Win-back message (not actually sent — no gateway configured)', [
            'debtor_no' => $customer?->debtor_no,
            'mobile' => $customer?->mobile,
            'channel' => $channel,
            'message' => $message,
        ]);
    }
}
