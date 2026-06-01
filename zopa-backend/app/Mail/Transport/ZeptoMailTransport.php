<?php

namespace App\Mail\Transport;

use Illuminate\Support\Facades\Http;
use Symfony\Component\Mailer\SentMessage;
use Symfony\Component\Mailer\Transport\AbstractTransport;
use Symfony\Component\Mime\Address;
use Symfony\Component\Mime\MessageConverter;

/**
 * Sends mail through the ZeptoMail HTTP API instead of SMTP.
 *
 * Why: hosts like Linode block outbound SMTP ports (25/465/587) on new
 * accounts. The HTTP API uses port 443, which is never blocked, so approval
 * emails work without waiting for an SMTP-unblock support ticket.
 *
 * Docs: https://www.zoho.com/zeptomail/help/api/email-sending.html
 */
class ZeptoMailTransport extends AbstractTransport
{
    public function __construct(
        private readonly string $token,
        private readonly string $endpoint = 'https://api.zeptomail.in/v1.1/email',
    ) {
        parent::__construct();
    }

    protected function doSend(SentMessage $message): void
    {
        $email = MessageConverter::toEmail($message->getOriginalMessage());

        $from = $email->getFrom()[0] ?? null;

        $payload = [
            'from'    => $this->address($from),
            'to'      => $this->recipients($email->getTo()),
            'subject' => $email->getSubject() ?? '',
        ];

        if ($cc = $email->getCc())        { $payload['cc'] = $this->recipients($cc); }
        if ($bcc = $email->getBcc())      { $payload['bcc'] = $this->recipients($bcc); }
        if ($reply = $email->getReplyTo()){ $payload['reply_to'] = array_map(fn (Address $a) => $this->address($a), $reply); }
        if ($html = $email->getHtmlBody()){ $payload['htmlbody'] = (string) $html; }
        if ($text = $email->getTextBody()){ $payload['textbody'] = (string) $text; }

        $attachments = [];
        foreach ($email->getAttachments() as $att) {
            $disposition = $att->getPreparedHeaders()->get('content-disposition');
            $name = $disposition?->getParameter('filename') ?? 'attachment';

            $attachments[] = [
                'name'      => $name,
                'content'   => base64_encode($att->getBody()),
                'mime_type' => $att->getMediaType() . '/' . $att->getMediaSubtype(),
            ];
        }
        if ($attachments) {
            $payload['attachments'] = $attachments;
        }

        $response = Http::withHeaders([
            'Authorization' => 'Zoho-enczapikey ' . $this->token,
            'Accept'        => 'application/json',
        ])->asJson()->post($this->endpoint, $payload);

        if ($response->failed()) {
            throw new \RuntimeException(
                'ZeptoMail API send failed [' . $response->status() . ']: ' . $response->body()
            );
        }
    }

    /** ZeptoMail "address object". */
    private function address(?Address $address): array
    {
        if (!$address) {
            return ['address' => '', 'name' => ''];
        }
        return [
            'address' => $address->getAddress(),
            'name'    => $address->getName() ?: $address->getAddress(),
        ];
    }

    /** ZeptoMail wraps each recipient as { email_address: {address, name} }. */
    private function recipients(array $addresses): array
    {
        return array_map(fn (Address $a) => ['email_address' => $this->address($a)], $addresses);
    }

    public function __toString(): string
    {
        return 'zeptomail';
    }
}
