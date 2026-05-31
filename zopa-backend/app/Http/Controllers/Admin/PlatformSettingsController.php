<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Manages ZOPA platform-level settings (parent company branding).
 * Stored as a JSON file in public storage — no migration required.
 */
class PlatformSettingsController extends Controller
{
    private const SETTINGS = 'platform/settings.json';
    private const LOGO_DIR = 'platform';

    // ── Helpers ──────────────────────────────────────────────────

    private function read(): array
    {
        if (!Storage::disk('public')->exists(self::SETTINGS)) {
            return [];
        }
        return json_decode(Storage::disk('public')->get(self::SETTINGS), true) ?? [];
    }

    private function save(array $data): void
    {
        Storage::disk('public')->put(self::SETTINGS, json_encode($data, JSON_PRETTY_PRINT));
    }

    private function withUrl(array $data): array
    {
        $data['logo_url'] = isset($data['logo_path'])
            ? url(Storage::url($data['logo_path']))
            : null;
        return $data;
    }

    // ── Endpoints ─────────────────────────────────────────────────

    public function show(): JsonResponse
    {
        return response()->json($this->withUrl($this->read()));
    }

    public function uploadLogo(Request $request): JsonResponse
    {
        $request->validate(['logo' => 'required|image|mimes:jpeg,png,gif,svg,webp|max:2048']);

        $settings = $this->read();

        // Delete old logo file
        if (!empty($settings['logo_path'])) {
            Storage::disk('public')->delete($settings['logo_path']);
        }

        $ext  = $request->file('logo')->getClientOriginalExtension();
        $path = $request->file('logo')->storeAs(self::LOGO_DIR, 'logo.' . $ext, 'public');

        $settings['logo_path'] = $path;
        $this->save($settings);

        return response()->json($this->withUrl($settings));
    }

    public function removeLogo(): JsonResponse
    {
        $settings = $this->read();
        if (!empty($settings['logo_path'])) {
            Storage::disk('public')->delete($settings['logo_path']);
        }
        unset($settings['logo_path']);
        $this->save($settings);
        return response()->json($this->withUrl($settings));
    }
}
