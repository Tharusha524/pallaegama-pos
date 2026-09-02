<?php

namespace App\Http\Controllers;

use App\Models\DebtorsMaster;
use App\Models\WinBackCampaign;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
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
     * Send a win-back offer to a customer via SMS (Notify.lk) or WhatsApp
     * (not yet supported by the configured gateway — logged only).
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
        $message = $data['message'] ?? 'A special offer for you!';

        $sendResult = $this->sendMessage($customer, $data['channel'], $message);

        $campaign = WinBackCampaign::create([
            'debtor_no' => $data['debtor_no'],
            'offer_id' => $data['offer_id'] ?? null,
            'channel' => $data['channel'],
            'sent_at' => now(),
            'redeemed' => false,
        ]);

        return response()->json([
            'campaign' => $campaign,
            'delivery' => $sendResult,
        ], 201);
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

    /**
     * @return array{sent: bool, provider: string, message?: string}
     */
    private function sendMessage(?DebtorsMaster $customer, string $channel, string $message): array
    {
        if (!$customer || empty($customer->mobile)) {
            Log::warning('Win-back message not sent — customer has no mobile number', [
                'debtor_no' => $customer?->debtor_no,
            ]);
            return ['sent' => false, 'provider' => 'none', 'message' => 'Customer has no mobile number on file'];
        }

        if ($channel === 'whatsapp') {
            // Notify.lk (configured gateway) sends SMS only — WhatsApp needs a
            // separate provider/API (e.g. WhatsApp Business API via Twilio).
            Log::info('WhatsApp win-back message not sent — no WhatsApp provider configured', [
                'debtor_no' => $customer->debtor_no,
                'mobile' => $customer->mobile,
            ]);
            return ['sent' => false, 'provider' => 'none', 'message' => 'No WhatsApp provider configured yet — SMS is supported'];
        }

        return $this->sendViaNotifyLk($customer->mobile, $message, $customer->debtor_no);
    }

    /**
     * @return array{sent: bool, provider: string, message?: string}
     */
    private function sendViaNotifyLk(string $mobile, string $message, int $debtorNo): array
    {
        $userId = config('services.notifylk.user_id');
        $apiKey = config('services.notifylk.api_key');
        $senderId = config('services.notifylk.sender_id');

        if (empty($userId) || empty($apiKey)) {
            Log::warning('Win-back SMS not sent — Notify.lk credentials are not configured', ['debtor_no' => $debtorNo]);
            return ['sent' => false, 'provider' => 'notifylk', 'message' => 'Notify.lk credentials not configured in .env'];
        }

        $to = $this->toSriLankanInternationalFormat($mobile);

        try {
            $response = Http::timeout(15)->get('https://app.notify.lk/api/v1/send', [
                'user_id' => $userId,
                'api_key' => $apiKey,
                'sender_id' => $senderId,
                'to' => $to,
                'message' => $message,
            ]);

            $body = $response->json();
            $status = $body['status'] ?? null;

            if ($response->successful() && $status === 'success') {
                Log::info('Win-back SMS sent via Notify.lk', ['debtor_no' => $debtorNo, 'to' => $to]);
                return ['sent' => true, 'provider' => 'notifylk'];
            }

            Log::warning('Notify.lk SMS send failed', ['debtor_no' => $debtorNo, 'to' => $to, 'response' => $body]);
            return ['sent' => false, 'provider' => 'notifylk', 'message' => $body['message'] ?? 'Notify.lk rejected the request'];
        } catch (\Throwable $e) {
            Log::error('Notify.lk SMS send threw an exception', ['debtor_no' => $debtorNo, 'error' => $e->getMessage()]);
            return ['sent' => false, 'provider' => 'notifylk', 'message' => 'Could not reach Notify.lk'];
        }
    }

    /**
     * Normalizes a Sri Lankan mobile number (0771234567, 771234567, or
     * already-international 94771234567) to the 94XXXXXXXXX format Notify.lk expects.
     */
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
