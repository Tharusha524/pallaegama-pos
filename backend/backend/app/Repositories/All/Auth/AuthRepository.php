<?php

namespace App\Repositories\All\Auth;

use App\Models\UserManagement;
use App\Repositories\Base\BaseRepository;
use App\Services\Auth\LoginActivityService;
use App\Services\Auth\LoginIpRestrictionService;
use App\Services\Auth\LoginThrottleService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthRepository extends BaseRepository implements AuthInterface
{
    public function __construct(UserManagement $model)
    {
        parent::__construct($model);
    }

    public function login(array $credentials, ?Request $request = null): ?array
    {
        $request = $request ?? request();
        $logger = app(LoginActivityService::class);
        $throttle = app(LoginThrottleService::class);
        $email = $credentials['email'] ?? '';



        $user = $this->model->where('email', $email)->first();

        if (!$user || !Hash::check($credentials['password'], $user->password)) {
            $logger->record(
                $request,
                false,
                $user?->id,
                $email,
                $user ? trim("{$user->first_name} {$user->last_name}") : null,
                $user?->role
            );
            $throttle->increment($request, $email);
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        if ($user->status !== 'active') {
            $logger->record(
                $request,
                false,
                $user->id,
                $user->email,
                trim("{$user->first_name} {$user->last_name}"),
                $user->role
            );
            $throttle->increment($request, $email);

            return [
                'error' => true,
                'message' => 'Your account is not active',
                'status' => 403
            ];
        }

        $ipRestriction = app(LoginIpRestrictionService::class);
        if ($ipRestriction->isEnabled() && ! $ipRestriction->isIpAllowed($request->ip())) {
            $logger->recordBlockedIp($request, $user->email, $user->id, trim("{$user->first_name} {$user->last_name}"), $user->role);
            $throttle->increment($request, $email);
            throw ValidationException::withMessages([
                'email' => ['Login is not allowed from your IP address. Contact your administrator.'],
            ]);
        }

        $logger->record(
            $request,
            true,
            $user->id,
            $user->email,
            trim("{$user->first_name} {$user->last_name}"),
            $user->role
        );

        $throttle->clear($request, $email);

        $expirationMinutes = config('security.auth.token_expiration_minutes');
        $expiresAt = is_numeric($expirationMinutes) && (int) $expirationMinutes > 0
            ? now()->addMinutes((int) $expirationMinutes)
            : null;

        $token = $user->createToken('auth-token', ['*'], $expiresAt)->plainTextToken;

        $this->pruneOldTokens($user);

        // fetch role row from security_roles by role name (the user_managements.role column)
        $roleRow = DB::table('security_roles')->where('role', $user->role)->first();

        $sections = [];
        $areas = [];

        // Per-user permissions take precedence over the role's permissions.
        // If the user has no permissions of their own assigned, fall back to
        // whatever their role grants (unchanged, pre-existing behaviour).
        if (!empty($user->sections) || !empty($user->areas)) {
            if (!empty($user->sections)) {
                $sections = array_values(array_filter(explode(';', $user->sections)));
            }
            if (!empty($user->areas)) {
                $areas = array_values(array_filter(explode(';', $user->areas)));
            }
        } elseif ($roleRow) {
            if (!empty($roleRow->sections)) {
                $sections = array_values(array_filter(explode(';', $roleRow->sections)));
            }
            if (!empty($roleRow->areas)) {
                $areas = array_values(array_filter(explode(';', $roleRow->areas)));
            }
        }

        return [
            'user' => [
                'id' => $user->id,
                'email' => $user->email,
                'telephone' => $user->telephone,
                'role' => $user->role,
                'role_id' => $roleRow->id ?? null,
                'sections' => $sections,
                'areas' => $areas,
                'status' => $user->status,
                'first_name' => $user->first_name,
                'last_name' => $user->last_name,
                'strict_access' => (bool) ($user->strict_access ?? false),
            ],
            'token' => $token
        ];
    }

    public function logout(UserManagement $user): bool
    {
        $user->currentAccessToken()?->delete();

        return true;
    }

    private function pruneOldTokens(UserManagement $user): void
    {
        $maxTokens = (int) config('security.auth.max_tokens_per_user', 10);
        if ($maxTokens <= 0) {
            return;
        }

        // Order by id (monotonically increasing, immune to any server clock
        // changes) rather than created_at — a clock adjustment could make a
        // brand-new token's created_at sort as "older" than existing rows,
        // causing it to be pruned immediately after issuance.
        $keepIds = $user->tokens()
            ->orderByDesc('id')
            ->limit($maxTokens)
            ->pluck('id');

        if ($keepIds->isEmpty()) {
            return;
        }

        $user->tokens()
            ->whereNotIn('id', $keepIds->all())
            ->delete();
    }
}