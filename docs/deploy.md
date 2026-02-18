# Deploying Dork Searcher

Three deployment paths are covered below. Pick whichever fits your setup.

| Path | Difficulty | Cost | Best for |
|------|-----------|------|----------|
| [Vercel](#1-vercel-recommended) | Easiest | Free tier available | Quick launch, zero-ops |
| [Cloudflare Pages](#2-cloudflare-pages) | Easy | Free tier available | Cloudflare-managed domains |
| [Self-host (VPS + Docker)](#3-self-host-vps--docker) | Moderate | ~$5/mo VPS | Full control |

---

## 1. Vercel (recommended)

### Deploy from GitHub

1. Push the repo to GitHub (public or private).
2. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
3. Import the repository. Vercel auto-detects Next.js — accept the defaults.
4. Click **Deploy**. The build runs `npm run build` and serves the app.

Every push to `main` triggers a new production deployment automatically.

### Connect a custom domain

1. In the Vercel dashboard, open your project → **Settings → Domains**.
2. Type your domain (e.g. `dorksearcher.com`) and click **Add**.
3. Vercel will show the DNS records you need to create at your registrar.

#### DNS records

**For an apex domain** (`dorksearcher.com`):

| Type | Name | Value |
|------|------|-------|
| A    | @    | `76.76.21.21` |

**For the www subdomain** (`www.dorksearcher.com`):

| Type  | Name | Value |
|-------|------|-------|
| CNAME | www  | `cname.vercel-dns.com` |

> Add **both** records so that apex and www both resolve. Vercel automatically
> redirects one to the other (configurable in the dashboard).

4. After DNS propagates (usually under 10 minutes), Vercel provisions a TLS
   certificate automatically. No further action needed.

### Environment variables

If you use any env vars (e.g. proxy config, API keys), add them in
**Settings → Environment Variables** in the Vercel dashboard.

---

## 2. Cloudflare Pages

### Deploy from GitHub

1. Push the repo to GitHub.
2. Log in to the [Cloudflare dashboard](https://dash.cloudflare.com/) →
   **Workers & Pages → Create application → Pages → Connect to Git**.
3. Select the repository and configure the build:

   | Setting | Value |
   |---------|-------|
   | Framework preset | Next.js |
   | Build command | `npm run build` |
   | Build output directory | `.next` |

4. Click **Save and Deploy**.

> Cloudflare Pages has built-in support for Next.js via `@cloudflare/next-on-pages`.
> If the default preset doesn't work, install the adapter:
>
> ```bash
> npm install -D @cloudflare/next-on-pages
> ```
>
> Then set the build command to `npx @cloudflare/next-on-pages` and the output
> directory to `.vercel/output/static`.

### Connect a custom domain

1. In the Pages project → **Custom domains → Set up a custom domain**.
2. Enter your domain (e.g. `dorksearcher.com`).
3. If the domain is already on Cloudflare DNS, the CNAME record is added
   automatically. Otherwise, add this record at your registrar:

   | Type  | Name | Value |
   |-------|------|-------|
   | CNAME | @    | `<your-pages-project>.pages.dev` |
   | CNAME | www  | `<your-pages-project>.pages.dev` |

4. TLS is provisioned automatically by Cloudflare.

### Environment variables

Add env vars in **Settings → Environment variables** for both Production and
Preview environments.

---

## 3. Self-host (VPS + Docker)

This path uses the included `Dockerfile`, `docker-compose.yml`, and
`nginx.conf` to run the app on any Linux VPS (Ubuntu/Debian recommended).

### Prerequisites

- A VPS with Docker and Docker Compose installed.
- A domain name with DNS pointing to the VPS IP.
- Ports 80 and 443 open in the firewall.

### Step 1 — Clone and build

```bash
git clone https://github.com/<your-user>/dork-searcher.git
cd dork-searcher
docker compose up -d --build
```

The app is now running on `http://localhost:3000`.

Verify it works:

```bash
curl -s http://localhost:3000 | head -20
```

### Step 2 — Point DNS to your VPS

At your domain registrar, create these records (replace `203.0.113.10` with
your VPS IP):

| Type | Name | Value |
|------|------|-------|
| A    | @    | `203.0.113.10` |
| A    | www  | `203.0.113.10` |

Wait for DNS to propagate (check with `dig yourdomain.com`).

### Step 3 — Set up Nginx

Install Nginx on the host (not inside Docker):

```bash
sudo apt update && sudo apt install -y nginx
```

Copy the included config:

```bash
# First, edit nginx.conf and replace yourdomain.com with your actual domain
sudo cp nginx.conf /etc/nginx/sites-available/dorksearcher
sudo ln -sf /etc/nginx/sites-available/dorksearcher /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

At this point, HTTP traffic on port 80 is redirected to HTTPS, but TLS is not
configured yet. Proceed to the next step.

### Step 4 — TLS with Certbot

Install Certbot:

```bash
sudo apt install -y certbot python3-certbot-nginx
```

Obtain a certificate (Certbot will patch the Nginx config automatically):

```bash
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Follow the prompts — provide an email and agree to the ToS.

Certbot sets up auto-renewal via a systemd timer. Verify it:

```bash
sudo certbot renew --dry-run
```

Your site is now live at `https://yourdomain.com` with automatic certificate
renewal.

### Step 5 — Keep it running

The `docker-compose.yml` includes `restart: unless-stopped`, so the container
restarts on reboot. To update:

```bash
cd dork-searcher
git pull
docker compose up -d --build
```

### Changing the port

The container listens on port 3000 by default. To change it, edit
`docker-compose.yml`:

```yaml
ports:
  - "8080:3000"   # host:container
```

Then update the `proxy_pass` line in `nginx.conf` to match.

### Environment variables

Add env vars in `docker-compose.yml` under the `environment` key:

```yaml
environment:
  - PORT=3000
  - HOSTNAME=0.0.0.0
  - MY_API_KEY=secret
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Build fails on Vercel | Check that `output: "standalone"` is in `next.config.ts`. Vercel handles this automatically, but it doesn't hurt. |
| 502 Bad Gateway from Nginx | Make sure the Docker container is running: `docker compose ps`. Check logs: `docker compose logs -f app`. |
| SSE streaming not working behind Nginx | The included `nginx.conf` disables proxy buffering. If you're using a CDN, disable response buffering there too. |
| DNS not propagating | Use `dig yourdomain.com` to check. Some registrars take up to 48 hours, but most propagate within 10 minutes. |
| Certbot fails | Make sure ports 80/443 are open and DNS points to your VPS. Run `sudo certbot --nginx` again. |
| Container won't start | Check logs: `docker compose logs app`. Common cause: port 3000 already in use on the host. |
