<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Http;

class PincodeController extends Controller
{
    public function lookup(string $pincode): JsonResponse
    {
        $pincode = preg_replace('/\D/', '', $pincode);

        if (strlen($pincode) < 4 || strlen($pincode) > 10) {
            return response()->json(['error' => 'Invalid pincode'], 422);
        }

        try {
            // OpenStreetMap Nominatim — free, no auth, universally accessible
            $res = Http::timeout(10)
                ->withoutVerifying()
                ->withHeaders(['User-Agent' => 'ZOPA-Procurement/1.0'])
                ->get('https://nominatim.openstreetmap.org/search', [
                    'q'              => $pincode,
                    'format'         => 'json',
                    'addressdetails' => 1,
                    'limit'          => 1,
                    'countrycodes'   => 'in',  // restrict to India; remove for global
                ]);

            if ($res->successful() && count($res->json()) > 0) {
                $place = $res->json()[0];
                $addr  = $place['address'] ?? [];

                $city  = $addr['city']
                    ?? $addr['town']
                    ?? $addr['municipality']
                    ?? $addr['suburb']
                    ?? $addr['district']
                    ?? $addr['county']
                    ?? $addr['village']
                    ?? '';
                $state   = $addr['state']   ?? '';
                $country = $addr['country'] ?? 'India';

                if ($city || $state) {
                    return response()->json([
                        'success' => true,
                        'city'    => $city,
                        'state'   => $state,
                        'country' => $country,
                        'source'  => 'OpenStreetMap',
                    ]);
                }
            }

            return response()->json(['success' => false, 'error' => 'Pincode not found'], 404);

        } catch (\Exception $e) {
            \Log::warning("Pincode lookup failed for {$pincode}: " . $e->getMessage());
            return response()->json(['success' => false, 'error' => 'Lookup service unavailable'], 503);
        }
    }
}
