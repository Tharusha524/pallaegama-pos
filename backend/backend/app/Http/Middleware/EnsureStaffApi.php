<?php

namespace App\Http\Middleware;

use App\Models\DebtorsMaster;
use Closure;
use Illuminate\Http\Request;

class EnsureStaffApi
{
    /** Every /api route needs a staff login unless config/public_api.php lists it. */
    public function handle(Request $request, Closure $next)
    {
        if ($request->isMethod('OPTIONS') || $this->isPublic($request)) {
            return $next($request);
        }

        $user = auth('sanctum')->user();
        if (! $user || $user instanceof DebtorsMaster) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        return $next($request);
    }

    private function isPublic(Request $request): bool
    {
        $method = $request->isMethod('HEAD') ? 'GET' : $request->method();
        $paths = array_merge(config("public_api.$method", []), config('public_api.ANY', []));

        foreach ($paths as $path) {
            if ($request->is('api/'.$path)) {
                return true;
            }
        }

        return false;
    }
}
