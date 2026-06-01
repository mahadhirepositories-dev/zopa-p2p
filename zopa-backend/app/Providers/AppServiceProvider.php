<?php

namespace App\Providers;

use App\Mail\Transport\ZeptoMailTransport;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // Custom "zeptomail" mailer transport (HTTP API — bypasses blocked SMTP ports).
        Mail::extend('zeptomail', function (array $config) {
            return new ZeptoMailTransport(
                $config['token'] ?? '',
                $config['endpoint'] ?? 'https://api.zeptomail.in/v1.1/email',
            );
        });
    }
}
