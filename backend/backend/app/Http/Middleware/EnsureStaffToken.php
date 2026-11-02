<?php

namespace App\Http\Middleware;

use App\Models\DebtorsMaster;
use Closure;
use Illuminate\Http\Request;

class EnsureStaffToken
{
    /**
     * Restrict a route to system users. A customer app token is a valid
     * Sanctum token too, so auth:sanctum alone would let it through.
     */
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (! $user || $user instanceof DebtorsMaster) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $next($request);
    }
}
