<?php

namespace App\Http\Controllers;

use App\Models\PosShift;
use Illuminate\Http\Request;

class PosShiftController extends Controller
{
    public function index(Request $request)
    {
        $query = PosShift::with(['user:id,name', 'salesPos:id,pos_name'])->orderByDesc('id');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('user_id')) {
            $query->where('user_id', $request->query('user_id'));
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id' => 'required|exists:users,id',
            'sales_pos_id' => 'nullable|exists:sales_pos,id',
            'opening_float' => 'required|numeric|min:0',
            'notes' => 'nullable|string',
        ]);

        $existingOpen = PosShift::where('user_id', $data['user_id'])->where('status', 'open')->first();
        if ($existingOpen) {
            return response()->json(['message' => 'This user already has an open shift', 'shift' => $existingOpen], 422);
        }

        $data['shift_start'] = now();
        $data['status'] = 'open';

        $shift = PosShift::create($data);
        return response()->json($shift, 201);
    }

    public function show(string $id)
    {
        $shift = PosShift::with(['user:id,name', 'salesPos:id,pos_name'])->find($id);
        if (!$shift) {
            return response()->json(['message' => 'Shift not found'], 404);
        }
        return response()->json($shift);
    }

    /**
     * Close a shift: record counted cash, compute variance against expected.
     */
    public function close(Request $request, string $id)
    {
        $shift = PosShift::find($id);
        if (!$shift) {
            return response()->json(['message' => 'Shift not found'], 404);
        }
        if ($shift->status === 'closed') {
            return response()->json(['message' => 'Shift already closed'], 422);
        }

        $data = $request->validate([
            'closing_expected' => 'required|numeric',
            'closing_counted' => 'required|numeric',
            'notes' => 'nullable|string',
        ]);

        $shift->closing_expected = $data['closing_expected'];
        $shift->closing_counted = $data['closing_counted'];
        $shift->variance = $data['closing_counted'] - $data['closing_expected'];
        $shift->notes = $data['notes'] ?? $shift->notes;
        $shift->shift_end = now();
        $shift->status = 'closed';
        $shift->save();

        return response()->json($shift);
    }
}
