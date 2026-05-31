# 🚀 Deploy ZOPA to Linode with CI/CD — explained simply

This guide takes you from "I have code on my laptop" to "every time I push to
GitHub, my website updates automatically." No prior DevOps knowledge needed —
just copy, paste, and read the comments.

---

## 🧠 First: SSR or just "build & deploy"?

**Use a plain static build (what you already have). Do NOT use SSR.**

Think of it like a printed brochure vs. a live chef:

| | Static build (what we use) | SSR (Server-Side Rendering) |
|---|---|---|
| How it works | Angular is turned into plain HTML/JS files once; the server just hands them out | A Node program re-cooks each page on every visit |
| Server needs | Just nginx (super light) | A always-running Node process (more RAM, more babysitting) |
| Deploys | Fast & simple | Slower, more moving parts |
| Good for | Apps behind a login (like yours) | Public sites that need Google SEO |

Your app is **behind a login** — Google never needs to read it, so SSR buys you
nothing and costs you complexity. For **frequent updates**, static wins: builds
are fast, there's no Node server to crash, and rollbacks are trivial.
✅ Decision: **static build + deploy.**

---

## 🗺️ The big picture (the "Lego diagram")

```
   YOU                 GITHUB (free robot)              LINODE (your server)
 ┌──────┐  git push   ┌───────────────────┐   ssh    ┌─────────────────────────┐
 │ code │ ─────────▶ │ 1. build Angular   │ ───────▶ │ nginx  → Angular files  │
 └──────┘            │ 2. send to server  │          │ php    → Laravel /api   │
                     │ 3. update backend  │          │ mysql  → database       │
                     └───────────────────┘          └─────────────────────────┘
```

- **One GitHub repo** holds BOTH apps (`zopa-backend/` and `zopa-frontend/`).
- **One Linode server** runs nginx + PHP + MySQL.
- **GitHub Actions** is the robot that builds and ships on every push.

---

## PART A — Put everything in ONE GitHub repo (do once)

Right now only `zopa-frontend` is a git repo. We want ONE repo at the top so a
single pipeline can deploy both. On your laptop, in `C:\Users\rdine\Desktop\ZOPA-PO`:

```bash
# 1. Remove the inner git repo from the frontend (we'll track it from the top)
rmdir /s /q zopa-frontend\.git      # Windows
# (mac/linux: rm -rf zopa-frontend/.git)

# 2. Start one git repo at the top
git init
git add .
git commit -m "Initial monorepo: backend + frontend + CI/CD"

# 3. Create an EMPTY repo on github.com (no README), then connect it:
git branch -M main
git remote add origin https://github.com/<your-username>/zopa.git
git push -u origin main
```

> Make sure `.gitignore` excludes secrets and junk. Both `zopa-backend/.env`
> and `zopa-frontend/node_modules` must NEVER be pushed. (Laravel & Angular
> already gitignore these by default.)

---

## PART B — Create the Linode server (do once)

1. Sign in at linode.com → **Create → Linode**.
2. **Image:** Ubuntu 24.04 LTS. **Region:** closest to your users.
3. **Plan:** *Nanode 1GB ($5)* is enough (we build on GitHub, not here).
   *2GB ($12)* is comfier for MySQL — pick that if unsure.
4. Set a strong **root password**, click **Create**.
5. Copy the server's **public IP** (looks like `172.105.12.34`).

### Point your domain at it
In your domain's DNS (where you manage zopapro.com), add an **A record**:
`p2p` → `172.105.12.34` (your IP). Wait a few minutes.

---

## PART C — Set up the server (do once, copy-paste)

SSH in as root (use the IP):

```bash
ssh root@172.105.12.34
```

Then paste these blocks one at a time.

### C1. Install the software
```bash
apt update && apt upgrade -y
apt install -y nginx mysql-server git unzip curl \
  php8.2-fpm php8.2-cli php8.2-mysql php8.2-mbstring php8.2-xml \
  php8.2-curl php8.2-zip php8.2-gd php8.2-bcmath

# Composer (PHP's npm)
curl -sS https://getcomposer.org/installer | php
mv composer.phar /usr/local/bin/composer
```

### C2. Create the database
```bash
mysql -e "CREATE DATABASE zopa_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -e "CREATE USER 'zopa'@'localhost' IDENTIFIED BY 'PUT-A-STRONG-PASSWORD-HERE';"
mysql -e "GRANT ALL PRIVILEGES ON zopa_db.* TO 'zopa'@'localhost'; FLUSH PRIVILEGES;"
```
✍️ Remember the password — it goes in the server `.env` (next part), NOT GitHub.

### C3. Create a "deployer" user (the robot logs in as this, never root)
```bash
adduser --disabled-password --gecos "" deployer
usermod -aG www-data deployer
mkdir -p /home/deployer/.ssh && chmod 700 /home/deployer/.ssh
```

Let `deployer` reload PHP without a password (only that one command):
```bash
echo "deployer ALL=(ALL) NOPASSWD: /bin/systemctl reload php8.2-fpm" \
  > /etc/sudoers.d/deployer
```

### C4. Make the two web folders & grab the code
```bash
mkdir -p /var/www/zopa-frontend
git clone https://github.com/<your-username>/zopa.git /var/www/zopa
chown -R deployer:www-data /var/www/zopa /var/www/zopa-frontend
```

### C5. Create the backend `.env` (the real secrets live HERE on the server)
```bash
cd /var/www/zopa/zopa-backend
cp .env.example .env   # if no example, create .env by hand
nano .env
```
Set at least these lines (use YOUR db password + domain):
```
APP_NAME=ZOPA
APP_ENV=production
APP_DEBUG=false
APP_URL=https://p2p.zopapro.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_DATABASE=zopa_db
DB_USERNAME=zopa
DB_PASSWORD=PUT-A-STRONG-PASSWORD-HERE

QUEUE_CONNECTION=database
MAIL_MAILER=smtp
MAIL_HOST=smtp.zeptomail.in
MAIL_PORT=587
MAIL_USERNAME=emailapikey
MAIL_PASSWORD=your-zeptomail-key
MAIL_FROM_ADDRESS=noreply@zopapro.com
```
Save (Ctrl+O, Enter, Ctrl+X).

### C6. First-time backend install + create the single super admin
```bash
composer install --no-dev --optimize-autoloader
php artisan key:generate
php artisan migrate:fresh --seed --force   # ⬅ builds the DB with ONE super admin
php artisan storage:link
chown -R deployer:www-data /var/www/zopa/zopa-backend/storage /var/www/zopa/zopa-backend/bootstrap/cache
chmod -R 775 /var/www/zopa/zopa-backend/storage /var/www/zopa/zopa-backend/bootstrap/cache
```
This gives you exactly one login: **webmaster@zopapro.com / ZOPA@123#**.

### C7. Turn on nginx
```bash
# copy the config from the repo
cp /var/www/zopa/deploy/nginx-zopa.conf /etc/nginx/sites-available/zopa
# (edit server_name inside if your domain differs)
ln -s /etc/nginx/sites-available/zopa /etc/nginx/sites-enabled/zopa
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
```

### C8. Free HTTPS padlock (Let's Encrypt)
```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d p2p.zopapro.com    # answer the prompts; choose redirect
```

✅ Visit `https://p2p.zopapro.com` — the server is live. (Frontend will fill in
after your first GitHub deploy in Part E.)

---

## PART D — GitHub secrets (what to add and why)

GitHub needs to know **how to log into your server**. That's all. Your database
password, mail keys, etc. stay in the server's `.env` and are NEVER in GitHub.

Go to your repo → **Settings → Secrets and variables → Actions → New repository
secret**, and add these **4 secrets**:

| Secret name | What to put in it | Example |
|---|---|---|
| `SSH_HOST` | Your Linode's public IP | `172.105.12.34` |
| `SSH_USER` | The deploy user we made | `deployer` |
| `SSH_PORT` | SSH port (almost always 22) | `22` |
| `SSH_PRIVATE_KEY` | The **private** half of an SSH key (see below) | `-----BEGIN OPENSSH PRIVATE KEY----- …` |

### How to make the SSH key (do once on your laptop)
```bash
ssh-keygen -t ed25519 -f zopa_deploy_key -C "github-deploy"
# creates two files: zopa_deploy_key (PRIVATE) and zopa_deploy_key.pub (PUBLIC)
```

- **PUBLIC key** (`.pub`) → goes on the **server** so `deployer` trusts it:
  ```bash
  # paste the contents of zopa_deploy_key.pub into this file on the server:
  nano /home/deployer/.ssh/authorized_keys
  chown deployer:deployer /home/deployer/.ssh/authorized_keys
  chmod 600 /home/deployer/.ssh/authorized_keys
  ```
- **PRIVATE key** (`zopa_deploy_key`, the whole file incl. BEGIN/END lines)
  → paste into the **`SSH_PRIVATE_KEY`** GitHub secret.

🔒 The private key is like a house key — only GitHub gets a copy, never commit it.

---

## PART E — Deploy! (every time, forever)

From now on, shipping an update is **one command**:

```bash
git add .
git commit -m "new feature / fix"
git push
```

GitHub will automatically:
1. Build the Angular app,
2. Copy it to `/var/www/zopa-frontend`,
3. Pull the backend, install packages, run migrations, clear caches, reload PHP.

Watch it happen: GitHub repo → **Actions** tab → click the latest run.
Green check = live. Red X = open the log; the failing step is highlighted.

> 💡 `php artisan migrate --force` runs automatically, so **new database
> changes ship themselves**. (It only *adds* changes; it never wipes data —
> the destructive `migrate:fresh` is only the one-time Part C6 command.)

---

## 🆘 Quick troubleshooting

| Symptom | Fix |
|---|---|
| Actions step "Deploy on server" fails on SSH | Re-check the 4 secrets; confirm the `.pub` key is in `/home/deployer/.ssh/authorized_keys` |
| Site shows nginx default page | You forgot `rm /etc/nginx/sites-enabled/default` then `systemctl reload nginx` |
| `/api` returns 404 | Check `nginx-zopa.conf` paths and `php artisan route:cache` ran |
| 500 error on API | `tail -f /var/www/zopa/zopa-backend/storage/logs/laravel.log` |
| Login fails | You haven't run the Part C6 seed yet, or DB creds in `.env` are wrong |
| Emails not sending | Add a queue worker: `php artisan queue:work` (or a systemd service) since prod uses the database queue |

---

## 🔁 (Optional) Make emails reliable in production

Production uses a database queue, so emails wait for a worker. Create a tiny
always-on service:

```bash
sudo nano /etc/systemd/system/zopa-queue.service
```
```ini
[Unit]
Description=ZOPA queue worker
After=network.target

[Service]
User=deployer
Restart=always
WorkingDirectory=/var/www/zopa/zopa-backend
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now zopa-queue
```

That's it. Push code → it goes live. 🎉
