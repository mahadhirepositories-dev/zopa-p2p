<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AiController extends Controller
{
    public function suggestTerms(Request $request): JsonResponse
    {
        $request->validate([
            'item_names'   => 'nullable|array',
            'category_ids' => 'nullable|array',
        ]);

        $itemNames = implode(', ', array_filter($request->item_names ?? []));
        $apiKey    = config('openai.api_key');

        if ($apiKey) {
            try {
                $result = \OpenAI\Laravel\Facades\OpenAI::chat()->create([
                    'model' => 'gpt-3.5-turbo',
                    'messages' => [
                        ['role' => 'system', 'content' => 'You are a procurement specialist drafting formal purchase order terms and conditions for Indian companies. Write concise, formal legal language.'],
                        ['role' => 'user', 'content' => "Generate purchase order terms and conditions for the procurement of: {$itemNames}. Include: delivery schedule, inspection & acceptance, quality & warranty, payment terms, penalty clauses, and governing law. Limit to 8 numbered clauses."],
                    ],
                    'max_tokens' => 700,
                ]);
                $terms = $result->choices[0]->message->content ?? null;
                if ($terms) {
                    return response()->json(['terms' => trim($terms)]);
                }
            } catch (\Throwable $e) {
                // fall through to default
            }
        }

        return response()->json(['terms' => $this->defaultTerms($itemNames)]);
    }

    private function defaultTerms(string $items): string
    {
        $forItems = $items ? " for supply of {$items}" : '';
        return "PURCHASE ORDER TERMS & CONDITIONS{$forItems}\n\n"
            . "1. DELIVERY: Goods shall be delivered to the specified location on or before the Required By date mentioned for each line item. Delivery schedule must be confirmed within 2 working days of PO receipt.\n\n"
            . "2. INSPECTION & ACCEPTANCE: All goods are subject to inspection upon receipt. The purchaser reserves the right to reject non-conforming goods. Rejected goods must be replaced within 7 working days at no additional cost.\n\n"
            . "3. QUALITY & WARRANTY: Supplier warrants all goods to be free from defects in material, workmanship and design for the warranty period specified in this PO. Defective goods must be repaired or replaced at the supplier's cost.\n\n"
            . "4. PAYMENT: Payment will be made as per the payment milestones specified in this PO, subject to satisfactory delivery, inspection acceptance, and submission of valid GST invoice.\n\n"
            . "5. GST COMPLIANCE: Supplier shall provide a valid GST invoice with correct GSTIN, HSN codes, and applicable tax rates. Input tax credit availability is a condition of payment.\n\n"
            . "6. PENALTY FOR DELAY: In the event of delay beyond the Required By date, a penalty of 0.5% of the delayed line item value per week, up to a maximum of 5%, may be levied at the purchaser's discretion.\n\n"
            . "7. FORCE MAJEURE: Neither party shall be liable for delays or failures caused by circumstances beyond their reasonable control, provided prompt written notice is given to the other party.\n\n"
            . "8. GOVERNING LAW: This Purchase Order shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in the purchaser's city.";
    }
}
