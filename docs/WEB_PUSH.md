# Guest pickup Web Push (PWA)

Background / closed-tab alerts for pickup waiting use **Web Push** + a lightweight service worker — not SMS/WhatsApp.

## Env vars

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client + server | Application server key for `pushManager.subscribe` |
| `VAPID_PRIVATE_KEY` | Server only | Signs push requests (`web-push`) |
| `VAPID_SUBJECT` | Server | Contact URI, e.g. `mailto:admin@qiktik.local` |

Generate:

```bash
npx web-push generate-vapid-keys
```

If VAPID is missing, Mark ready / Ping still use SSE + in-page `Notification` only.

## Guest steps

1. Open the waiting ticket page (or Add to Home Screen first on iOS).
2. Tap **Enable browser notifications** and allow permission.
3. Keep the PWA/tab installed; staff Mark ready / Ping send a push when subscribed.

## Secure context

Service workers and Web Push need a **secure context**: `https://…` or `http://localhost` / `http://127.0.0.1`.  
A phone opening `http://192.168.x.x:3000` usually **cannot** register a service worker — use localhost (desktop), a tunnel (e.g. ngrok / Cloudflare Tunnel), or HTTPS. In-page `Notification` + SSE still work on LAN HTTP when the tab is open **and not frozen**.

## iOS limits

- Web Push needs **iOS 16.4+** and the site **added to the Home Screen** (standalone PWA) over **HTTPS**.
- A normal Safari tab — including one left “in the background” — does **not** receive Web Push. Background Safari tabs are suspended.
- Push delivery still needs a working network; expired subscriptions are cleared on 404/410.

**iPhone LAN demo steps (tunnel + Home Screen):** see [IOS_PUSH.md](./IOS_PUSH.md).
