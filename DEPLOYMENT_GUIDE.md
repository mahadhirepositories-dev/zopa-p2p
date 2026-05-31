# ZOPA Deployment Guide — p2p.zopapro.com (Hostinger Cloud Startup)

## Credentials
- **URL**: https://p2p.zopapro.com
- **Login**: webmaster@zopapro.com / ZOPA@123#
- **DB**: u494205062_p2pzopa
- **Email**: ZeptoMail (noreply@zopapro.com)

---

## Step 1 — Hostinger hPanel Setup

1. Log into hPanel → **Websites** → Manage p2p.zopapro.com
2. Go to **Advanced** → **PHP Configuration** → set PHP to **8.2** or **8.3**
3. Go to **Databases** → confirm `u494205062_p2pzopa` exists
4. Go to **File Manager** → navigate to `public_html/` (or the subdomain root)

---

## Step 2 — Upload Files

Upload the contents of `zopa-deploy-p2p.zip` to the **root of p2p.zopapro.com**:

```
p2p.zopapro.com/          ← this is your web root configured in hPanel
├── app/                  ← Laravel application code
├── bootstrap/
├── config/
├── database/
├── public/               ← THIS must be the document root in hPanel
│   ├── .htaccess
│   ├── index.php
│   ├── app/              ← Angular SPA (built files)
│   └── storage/          ← symlinked to ../storage/app/public
├── routes/
├── storage/
├── vendor/
├── .env                  ← production config (already set)
└── artisan
```

### ⚠️ Important: Set document root to `/public`
In hPanel → Subdomains → p2p.zopapro.com → change **Document Root** to:
```
/public_html/p2p.zopapro.com/public
```
(adjust path based on your Hostinger structure)

---

## Step 3 — SSH Commands (run after upload)

Connect via SSH and run:

```bash
cd ~/p2p.zopapro.com   # or wherever you uploaded

# Install PHP dependencies
composer install --no-dev --optimize-autoloader

# Generate a fresh app key (do this once)
php artisan key:generate

# Run migrations + seed (creates webmaster login)
php artisan migrate:fresh --seed --force

# Create storage symlink
php artisan storage:link

# Cache everything for performance
php artisan config:cache
php artisan route:cache
php artisan view:cache

# Set permissions
chmod -R 775 storage bootstrap/cache
chmod -R 755 public
```

---

## Step 4 — Verify

1. Open https://p2p.zopapro.com → should load Angular login page
2. Login: `webmaster@zopapro.com` / `ZOPA@123#`
3. Go to **Client Management** → create your first tenant
4. Test email: create a PR, approve it → check if approval email arrives

---

## Troubleshooting

### 500 Error
```bash
tail -50 storage/logs/laravel.log
```

### White page / Angular doesn't load
- Check document root is set to `/public` (not the app root)
- Check `.htaccess` is uploaded and `mod_rewrite` is enabled

### API 404
- Ensure `.htaccess` rules are active
- Check `APP_URL=https://p2p.zopapro.com` in `.env`

### Email not sending
- Verify ZeptoMail domain `zopapro.com` is verified in ZeptoMail dashboard
- Check spam folder
- Test: `php artisan tinker` → `Mail::raw('test', fn($m) => $m->to('test@example.com')->subject('Test'));`

---

## Re-deploy (updates)

```bash
# After uploading changed files:
php artisan config:clear && php artisan config:cache
php artisan route:clear  && php artisan route:cache
php artisan view:clear   && php artisan view:cache
php artisan migrate --force   # only if new migrations
```

---

## App Key Note
The `.env` already has `APP_KEY`. If you run `php artisan key:generate`, update it in `.env` and re-cache.
