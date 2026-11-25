# iPhone Web Push for QikTik pickup

## Why `http://10.0.0.64:3000` fails on iPhone

Jawad’s LAN demo URL is **plain HTTP** on a private IP. On iPhone:

1. **Service Worker + Web Push need a secure context** — `https://…` or `http://localhost` / `127.0.0.1`.  
   `http://10.0.0.x:3000` is **not** secure → SW registration and push subscribe are blocked.
2. **iOS Web Push only works for a Home Screen / standalone PWA** (iOS 16.4+).  
   A normal Safari tab — even left open in the background — does **not** receive Web Push. Background tabs are also suspended, so SSE / `new Notification` from the page are unreliable when Safari freezes the tab.

There is no code fix that makes Safari-background-tab push work without **HTTPS + Add to Home Screen**.

## What works

| Client | Background push? |
|--------|------------------|
| Safari tab on `http://10.0.0.x` | No |
| Safari tab on `https://…` | No (in-page only while open) |
| Home Screen PWA on `https://…` (iOS 16.4+) | Yes, after Allow |
| Desktop Chrome on `localhost` / HTTPS | Yes |

## Local demo: free HTTPS tunnel

Keep `next dev` on the PC. Expose it with a free tunnel so the iPhone opens **https**.

### Option A — Cloudflare Tunnel (recommended, free)

1. Install [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/).
2. On the QikTik PC (with `npm run dev` already on port 3000):

```bash
cloudflared tunnel --url http://localhost:3000
```

3. Copy the printed `https://….trycloudflare.com` URL.
4. On the iPhone (same or any network), open that HTTPS URL → `/ar/main`, then register for pickup (or your locale).
5. You do **not** need to change `NEXT_PUBLIC_MENU_BASE_URL` for the tunnel: QR/admin links
   follow the request Host when it is not localhost. Keep the LAN value for Wi‑Fi demos.
   In-app menu links are always same-origin relative (they will not bounce you to `http://10.0.0.x`).

> Quick tunnels change subdomain every restart — remove any old Home Screen icon and
> **Add to Home Screen again** from the new `https://….trycloudflare.com` URL.

### Option B — ngrok (free tier)

```bash
npx ngrok http 3000
```

Use the `https://….ngrok-free.app` URL the same way.

> Tip: npm has no built-in tunnel. Use `cloudflared` or `npx ngrok` as above — see also the comment on `dev:tunnel-hint` in `package.json`.

## Exact iPhone 15 Pro Max test steps

1. Start QikTik: `npm run dev` (VAPID keys set in `.env` — see [WEB_PUSH.md](./WEB_PUSH.md)).
2. Start a tunnel → open the **https://** URL on the iPhone.
3. Register / open a waiting ticket page.
4. In Safari: **Share → Add to Home Screen** → Add.
5. **Close the Safari tab** (optional but clearer). Open the app from the **Home Screen** icon (status bar should look like a standalone app, not Safari).
6. On the waiting page tap **Enable notifications** → **Allow**.
7. You should see “Background notifications on”.
8. Leave the PWA (home or lock screen). From staff UI, **Mark ready** or **Ping**.
9. The iPhone should show a system notification; tap it to return to the waiting page.

## Checklist if push still fails

- [ ] URL starts with `https://` (not `http://10.0.0.x`)
- [ ] App opened from **Home Screen**, not Safari
- [ ] Waiting page status says **Background notifications on** / push subscription saved (not “keep this page open”)
- [ ] iOS **16.4+**
- [ ] `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` set and server restarted
- [ ] Permission is **Allow** (Settings → notifications for the web app if previously denied)
- [ ] Staff action hits the same ticket that subscribed
- [ ] Server console shows `[push-subscribe] saved` then `[web-push] sent …` (not `no-subscription`)
