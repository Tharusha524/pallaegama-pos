<?php

namespace App\Http\Controllers;

use App\Models\ServiceTicket;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class ServiceTicketController extends Controller
{
    public function index(Request $request)
    {
        $query = ServiceTicket::with('debtor:debtor_no,name,mobile')->orderByDesc('id');
        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'debtor_no' => 'nullable|exists:debtors_master,debtor_no',
            'item_description' => 'required|string|max:200',
            'serial_no' => 'nullable|string|max:100',
            'issue_notes' => 'nullable|string',
            'due_date' => 'nullable|date',
        ]);

        $data['ticket_no'] = 'TKT-' . strtoupper(Str::random(8));
        $data['status'] = 'received';
        $data['received_date'] = now()->toDateString();
        $data['created_by'] = $request->user()->id ?? null;

        return response()->json(ServiceTicket::create($data)->load('debtor:debtor_no,name,mobile'), 201);
    }

    public function update(Request $request, string $id)
    {
        $ticket = ServiceTicket::find($id);
        if (!$ticket) {
            return response()->json(['message' => 'Ticket not found'], 404);
        }

        $data = $request->validate([
            'status' => 'sometimes|required|in:received,in_progress,ready_for_pickup,delivered',
            'issue_notes' => 'nullable|string',
            'serial_no' => 'nullable|string|max:100',
            'due_date' => 'nullable|date',
        ]);

        $ticket->update($data);
        return response()->json($ticket->load('debtor:debtor_no,name,mobile'));
    }
}
