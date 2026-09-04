<?php

namespace App\Http\Controllers;

use App\Http\Requests\QuotationRequest;
use App\Mail\SendQuotation;
use App\Models\QuotationDetail;
use App\Repositories\All\Quotations\QuotationsInterface;
use App\Repositories\All\QuotationDetails\QuotationDetailsInterface;
use App\Services\CompanyReportHeader;
use App\Services\Sales\SalesQuotationBridgeService;
use App\Services\Pdf\TcpdfGenerator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;

class QuotationController extends Controller
{
    private QuotationsInterface $quotations;
    private QuotationDetailsInterface $quotationDetails;
    private TcpdfGenerator $pdf;

    public function __construct(
        QuotationsInterface $quotations,
        QuotationDetailsInterface $quotationDetails,
        TcpdfGenerator $pdf,
        private SalesQuotationBridgeService $faQuotations,
    )
    {
        $this->quotations = $quotations;
        $this->quotationDetails = $quotationDetails;
        $this->pdf = $pdf;
    }

    /**
     * Display a listing of quotations.
     */
    public function index(Request $request)
    {
        try {
            if ((int) $request->input('trans_type', 32) === 32) {
                return response()->json($this->faQuotations->list($request->all()));
            }

            $page = $request->input('page', 1);
            $perPage = $request->input('per_page', 15);

            $quotations = $this->quotations->paginate($perPage);

            return response()->json($quotations);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error fetching quotations',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Store a newly created quotation.
     */
    public function store(QuotationRequest $request)
    {
        try {
            $data = $request->validated();

            if ((int) ($data['trans_type'] ?? 32) === 32) {
                $total = 0.0;
                foreach ($data['details'] as $detail) {
                    $discount = ($detail['unit_price'] * $detail['quantity']) * ($detail['discount_percent'] ?? 0) / 100;
                    $total += ($detail['unit_price'] * $detail['quantity']) - $discount;
                }
                $total += (float) ($data['freight_cost'] ?? 0);

                $result = $this->faQuotations->create([
                    'debtor_no' => (int) $data['debtor_no'],
                    'branch_code' => (int) ($data['branch_code'] ?? 0),
                    'reference' => $data['reference'] ?? $data['quotation_number'],
                    'customer_ref' => $data['customer_ref'] ?? '',
                    'comments' => $data['comments'] ?? '',
                    'ord_date' => substr((string) $data['quotation_date'], 0, 10),
                    'delivery_date' => isset($data['delivery_date']) ? substr((string) $data['delivery_date'], 0, 10) : substr((string) $data['quotation_date'], 0, 10),
                    // No hardcoded fallback id — that was assuming sales_type 1
                    // always exists, which it doesn't have to. Fall back to
                    // whichever sales type actually exists instead.
                    'order_type' => (int) ($data['order_type'] ?? DB::table('sales_types')->min('id') ?? 0),
                    // Same issue as order_type below — 1 isn't guaranteed to
                    // exist in shipping_companies, so fall back to whichever
                    // shipper actually does.
                    'ship_via' => (int) ($data['ship_via'] ?? DB::table('shipping_companies')->min('shipper_id') ?? 0),
                    'delivery_address' => $data['delivery_address'] ?? '',
                    'freight_cost' => (float) ($data['freight_cost'] ?? 0),
                    'from_stk_loc' => $data['from_stk_loc'] ?? '',
                    'payment_terms' => $data['payment_terms'] ?? null,
                    'total' => $total,
                ], $data['details']);

                return response()->json([
                    'message' => 'Quotation created successfully (FA sales order type 32)',
                    'quotation' => $result['order'],
                    'lines' => $result['lines'],
                ], 201);
            }

            $data['created_by'] = Auth::id();
            $data['updated_by'] = Auth::id();

            // Calculate total
            $total = 0;
            $details = $data['details'];
            unset($data['details']);

            foreach ($details as $detail) {
                $discount = ($detail['unit_price'] * $detail['quantity']) * ($detail['discount_percent'] ?? 0) / 100;
                $detail['line_total'] = ($detail['unit_price'] * $detail['quantity']) - $discount;
                $total += $detail['line_total'];
            }

            $data['total'] = $total + ($data['freight_cost'] ?? 0);

            // Create quotation
            $quotation = $this->quotations->create($data);

            // Create quotation details
            foreach ($details as $detail) {
                $detail['quotation_id'] = $quotation->quotation_id;
                $this->quotationDetails->create($detail);
            }

            $quotation->load('details');

            return response()->json([
                'message' => 'Quotation created successfully',
                'quotation' => $quotation
            ], 201);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error creating quotation',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Display the specified quotation.
     */
    public function show(string $id)
    {
        try {
            $quotation = $this->quotations->find($id);

            if (!$quotation) {
                return response()->json(['message' => 'Quotation not found'], 404);
            }

            $quotation->load(['debtor', 'details', 'createdByUser', 'transType']);

            return response()->json($quotation);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error fetching quotation',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update the specified quotation.
     */
    public function update(QuotationRequest $request, string $id)
    {
        try {
            $quotation = $this->quotations->find($id);

            if (!$quotation) {
                return response()->json(['message' => 'Quotation not found'], 404);
            }

            // Don't allow updates if quotation is sent or accepted
            if (in_array($quotation->status, ['sent', 'accepted'])) {
                return response()->json([
                    'message' => 'Cannot update quotation with status: ' . $quotation->status
                ], 403);
            }

            $data = $request->validated();
            $data['updated_by'] = Auth::id();

            // Calculate total
            $total = 0;
            $details = $data['details'];
            unset($data['details']);

            foreach ($details as $detail) {
                $discount = ($detail['unit_price'] * $detail['quantity']) * ($detail['discount_percent'] ?? 0) / 100;
                $detail['line_total'] = ($detail['unit_price'] * $detail['quantity']) - $discount;
                $total += $detail['line_total'];
            }

            $data['total'] = $total + ($data['freight_cost'] ?? 0);

            // Update quotation
            $this->quotations->update($id, $data);

            // Delete old details and create new ones
            $oldDetails = QuotationDetail::where('quotation_id', $quotation->quotation_id)->get();
            foreach ($oldDetails as $detail) {
                $this->quotationDetails->delete($detail->id);
            }

            foreach ($details as $detail) {
                $detail['quotation_id'] = $quotation->quotation_id;
                $this->quotationDetails->create($detail);
            }

            $quotation = $this->quotations->find($id);
            $quotation->load('details');

            return response()->json([
                'message' => 'Quotation updated successfully',
                'quotation' => $quotation
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error updating quotation',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete the specified quotation.
     */
    public function destroy(string $id)
    {
        try {
            $quotation = $this->quotations->find($id);

            if (!$quotation) {
                return response()->json(['message' => 'Quotation not found'], 404);
            }

            $this->quotations->delete($id);

            return response()->json(['message' => 'Quotation deleted successfully']);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error deleting quotation',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Print a real FA quotation (sales_orders, trans_type 32 — the genuine,
     * accounting-integrated kind POS Checkout's "Give Quote" creates) as a
     * PDF, reusing the exact same quotations.pdf template printPdf() below
     * uses for the older, separate `quotations` table. That template can't
     * read a sales_orders row directly (different shape entirely), so this
     * builds a compatible stand-in object with the same property names.
     */
    public function printFaPdf(string $orderNo)
    {
        try {
            $order = DB::table('sales_orders')
                ->where('order_no', $orderNo)
                ->where('trans_type', 32)
                ->first();

            if (!$order) {
                return response()->json(['message' => 'Quotation not found'], 404);
            }

            $debtor = DB::table('debtors_master')->where('debtor_no', $order->debtor_no)->first();

            $lines = DB::table('sales_order_details')
                ->where('order_no', $orderNo)
                ->where('trans_type', 32)
                ->get()
                ->map(function ($line) {
                    $stock = DB::table('stock_master')->where('stock_id', $line->stk_code)->first();
                    $netPrice = (float) $line->unit_price * (1 - (float) ($line->discount_percent ?? 0) / 100);

                    return (object) [
                        'stk_code' => $line->stk_code,
                        'description' => $line->description,
                        'quantity' => $line->quantity,
                        'unit_price' => $line->unit_price,
                        'discount_percent' => $line->discount_percent,
                        'line_total' => round($netPrice * (float) $line->quantity, 2),
                        'stock' => $stock ? (object) ['long_description' => $stock->long_description] : null,
                    ];
                });

            $quotation = (object) [
                'quotation_number' => $order->reference ?: ('QUOTE-' . $order->order_no),
                'quotation_date' => \Carbon\Carbon::parse($order->ord_date),
                'status' => 'draft',
                'debtor' => (object) [
                    'name' => $debtor->name ?? 'N/A',
                    'address' => $debtor->address ?? '',
                ],
                'contact_email' => $order->contact_email,
                'contact_phone' => $order->contact_phone,
                'delivery_address' => $order->delivery_address,
                'delivery_date' => $order->delivery_date ? \Carbon\Carbon::parse($order->delivery_date) : null,
                'details' => $lines,
                'freight_cost' => $order->freight_cost,
                'total' => $order->total,
                'comments' => $order->comments,
            ];

            return $this->pdf->downloadFromView(
                'quotations.pdf',
                [
                    'quotation' => $quotation,
                    'companyHeader' => CompanyReportHeader::forReports(),
                ],
                'quotation-' . $quotation->quotation_number . '.pdf',
                'P'
            );
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error generating PDF',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Print quotation as PDF.
     */
    public function printPdf(string $id)
    {
        try {
            $quotation = $this->quotations->find($id);

            if (!$quotation) {
                return response()->json(['message' => 'Quotation not found'], 404);
            }

            $quotation->load(['debtor', 'details.stock', 'transType']);

            return $this->pdf->downloadFromView(
                'quotations.pdf',
                [
                    'quotation' => $quotation,
                    'companyHeader' => CompanyReportHeader::forReports(),
                ],
                'quotation-' . $quotation->quotation_number . '.pdf',
                'P'
            );
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error generating PDF',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Send quotation via email.
     */
    public function sendEmail(Request $request, string $id)
    {
        try {
            $quotation = $this->quotations->find($id);

            if (!$quotation) {
                return response()->json(['message' => 'Quotation not found'], 404);
            }

            $quotation->load(['debtor', 'details']);

            // Get email address from request or use debtor's email
            $email = $request->email ?? $quotation->contact_email ?? $quotation->debtor->email;

            if (!$email) {
                return response()->json([
                    'message' => 'No email address found for this quotation'
                ], 400);
            }

            // Send the email
            Mail::to($email)->send(new SendQuotation($quotation));

            // Update quotation status to 'sent'
            $this->quotations->update($id, [
                'status' => 'sent',
                'updated_by' => Auth::id()
            ]);

            return response()->json([
                'message' => 'Quotation sent successfully to ' . $email
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error sending quotation',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Update quotation status.
     */
    public function updateStatus(Request $request, string $id)
    {
        try {
            $request->validate([
                'status' => 'required|in:draft,sent,accepted,rejected,expired'
            ]);

            $quotation = $this->quotations->find($id);

            if (!$quotation) {
                return response()->json(['message' => 'Quotation not found'], 404);
            }

            $this->quotations->update($id, [
                'status' => $request->status,
                'updated_by' => Auth::id()
            ]);

            $quotation = $this->quotations->find($id);

            return response()->json([
                'message' => 'Quotation status updated successfully',
                'quotation' => $quotation
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error updating status',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get quotation statistics.
     */
    public function statistics(Request $request)
    {
        try {
            $allQuotations = $this->quotations->all();

            $stats = [
                'draft' => $allQuotations->where('status', 'draft')->count(),
                'sent' => $allQuotations->where('status', 'sent')->count(),
                'accepted' => $allQuotations->where('status', 'accepted')->count(),
                'rejected' => $allQuotations->where('status', 'rejected')->count(),
                'expired' => $allQuotations->where('status', 'expired')->count(),
                'total_value' => $allQuotations->where('status', 'accepted')->sum('total'),
            ];

            return response()->json($stats);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Error fetching statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
