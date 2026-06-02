<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetMail;
use App\Models\User;
use App\Models\UserTenantRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $user = \App\Models\User::where('email', $request->email)
            ->where('is_active', true)
            ->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'Invalid credentials.',
            ]);
        }

        $token = $user->createToken('api-token')->plainTextToken;

        $clients = UserTenantRole::with('tenant')
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->get()
            ->map(fn($r) => [
                'tenant_id' => $r->tenant_id,
                'tenant_name' => $r->tenant->name,
                'role' => $r->role,
                'is_internal' => (bool) $r->tenant->is_internal,
            ]);

        return response()->json([
            'token' => $token,
            'user' => $this->userPayload($user),
            'clients' => $clients,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['message' => 'Logged out']);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        $clients = UserTenantRole::with('tenant')
            ->where('user_id', $user->id)
            ->where('is_active', true)
            ->get()
            ->map(fn($r) => [
                'tenant_id' => $r->tenant_id,
                'tenant_name' => $r->tenant->name,
                'role' => $r->role,
                'is_internal' => (bool) $r->tenant->is_internal,
            ]);

        return response()->json([
            'user' => $this->userPayload($user),
            'clients' => $clients,
        ]);
    }

    /**
     * Update the authenticated user's own profile (name, phone).
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        $validated = $request->validate([
            'name'  => 'required|string|max:255',
            'phone' => 'nullable|string|max:30',
        ]);

        $user->update([
            'name'  => $validated['name'],
            'phone' => $validated['phone'] ?? null,
        ]);

        return response()->json([
            'message' => 'Profile updated successfully.',
            'user'    => $this->userPayload($user->fresh()),
        ]);
    }

    /**
     * Change the authenticated user's own password.
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();

        $request->validate([
            'current_password' => 'required|string',
            'password'         => 'required|string|min:8|confirmed',
        ]);

        if (!Hash::check($request->current_password, $user->password)) {
            throw ValidationException::withMessages([
                'current_password' => 'Your current password is incorrect.',
            ]);
        }

        $user->update(['password' => Hash::make($request->password)]);

        // Invalidate all OTHER sessions/tokens for safety, keep the current one.
        $currentTokenId = $user->currentAccessToken()->id;
        $user->tokens()->where('id', '!=', $currentTokenId)->delete();

        return response()->json(['message' => 'Password changed successfully.']);
    }

    /**
     * Send a password-reset link to the user's email.
     *
     * Always responds 200 with a generic message — we never reveal whether an
     * account exists for the given address (prevents email enumeration).
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => 'required|email']);

        $user = User::where('email', $request->email)->where('is_active', true)->first();

        if ($user) {
            $token    = Password::createToken($user);
            $resetUrl = rtrim((string) config('app.frontend_url'), '/')
                . '/reset-password?token=' . $token
                . '&email=' . urlencode($user->email);

            try {
                Mail::to($user->email)->queue(new PasswordResetMail($user, $resetUrl));
            } catch (\Throwable $e) {
                report($e);
            }
        }

        return response()->json([
            'message' => 'If an account exists for that email, a password reset link has been sent.',
        ]);
    }

    /**
     * Complete a password reset using the token from the emailed link.
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token'    => 'required|string',
            'email'    => 'required|email',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => Hash::make($password)])->save();
                // Revoke all existing API tokens so any old sessions can't continue.
                $user->tokens()->delete();
            }
        );

        if ($status === Password::PASSWORD_RESET) {
            return response()->json(['message' => 'Your password has been reset. You can now sign in.']);
        }

        throw ValidationException::withMessages([
            'email' => [__($status)],
        ]);
    }

    /**
     * Consistent shape for the authenticated user across login / me / profile.
     */
    private function userPayload(\App\Models\User $user): array
    {
        return [
            'id'            => $user->id,
            'name'          => $user->name,
            'email'         => $user->email,
            'phone'         => $user->phone,
            'is_zopa_staff' => $user->is_zopa_staff,
            'created_at'    => $user->created_at,
        ];
    }
}
