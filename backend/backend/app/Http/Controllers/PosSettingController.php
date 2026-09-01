<?php

namespace App\Http\Controllers;

use App\Models\PosSetting;
use Illuminate\Http\Request;

class PosSettingController extends Controller
{
    public function index()
    {
        return response()->json(PosSetting::all()->pluck('value', 'key'));
    }

    public function update(Request $request)
    {
        $data = $request->validate(['settings' => 'required|array']);

        foreach ($data['settings'] as $key => $value) {
            PosSetting::updateOrCreate(['key' => $key], ['value' => is_array($value) ? json_encode($value) : $value]);
        }

        return response()->json(PosSetting::all()->pluck('value', 'key'));
    }
}
