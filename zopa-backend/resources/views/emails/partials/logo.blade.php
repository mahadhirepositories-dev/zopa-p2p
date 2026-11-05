{{-- PNG because not every mail client renders WebP. It is flattened onto charcoal and styled inline so the light wordmark stays legible if a client strips the <style> block. --}}
<div style="background: #3c3c3b; border-bottom: 3px solid #d8ac27; padding: 14px 28px;">
  <img src="{{ rtrim((string) config('app.frontend_url'), '/') }}/brand/logo-email.png" width="136" height="48" alt="ZOPA" style="display: block; color: #ffffff; font-weight: bold;">
</div>
