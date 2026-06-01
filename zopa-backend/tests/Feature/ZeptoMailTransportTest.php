<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

/**
 * Verifies the custom ZeptoMail HTTP transport converts a Laravel mail into the
 * ZeptoMail API payload and POSTs it (so email works despite blocked SMTP ports).
 */
class ZeptoMailTransportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config([
            'mail.default'           => 'zeptomail',
            'mail.mailers.zeptomail' => [
                'transport' => 'zeptomail',
                'token'     => 'test-token',
                'endpoint'  => 'https://api.zeptomail.in/v1.1/email',
            ],
            'mail.from' => ['address' => 'noreply@zopapro.com', 'name' => 'ZOPA'],
        ]);
    }

    public function test_it_posts_a_correct_payload_to_the_zeptomail_api(): void
    {
        Http::fake(['api.zeptomail.in/*' => Http::response(['data' => [['code' => 'EM_104']]], 201)]);

        Mail::html('<b>Hello from ZOPA</b>', function ($m) {
            $m->to('approver@example.com', 'Approver')->subject('PO Approval Required');
        });

        Http::assertSent(function ($request) {
            $body = $request->data();
            return str_contains($request->url(), 'api.zeptomail.in')
                && $request->hasHeader('Authorization', 'Zoho-enczapikey test-token')
                && $body['from']['address'] === 'noreply@zopapro.com'
                && $body['to'][0]['email_address']['address'] === 'approver@example.com'
                && $body['subject'] === 'PO Approval Required'
                && str_contains($body['htmlbody'], 'Hello from ZOPA');
        });
    }

    public function test_a_failed_api_response_throws(): void
    {
        Http::fake(['api.zeptomail.in/*' => Http::response(['error' => 'bad token'], 401)]);

        $this->expectException(\Throwable::class);

        Mail::html('<b>x</b>', fn ($m) => $m->to('x@example.com')->subject('x'));
    }
}
