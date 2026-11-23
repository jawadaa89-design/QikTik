# QikTik production — qiktik.tech

## URL convention

| Purpose | Path |
|---------|------|
| Demo venue root | `https://qiktik.tech/r/myrestaurant` |
| Menu | `/r/myrestaurant/ar/menu` |
| Pickup guest | `/r/myrestaurant/ar/pickup` |
| Table QR | `/r/myrestaurant/ar/t/{token}` |
| Admin | `/r/myrestaurant/admin` |
| Alerts / pickup boards | `/r/myrestaurant/alerts`, `/r/myrestaurant/pickup` |
| Create venues | `/platform` |

Legacy `/{locale}/…` and `/admin` redirect into `/r/myrestaurant/…`.

## Deploy (Vercel + Neon)

1. Import GitHub repo `jawadaa89-design/QikTik` into Vercel.
2. Set production env (see `.env.example`):
   - `DATABASE_URL` — Neon connection string
   - `NEXT_PUBLIC_MENU_BASE_URL=https://qiktik.tech`
   - `NEXT_PUBLIC_DEFAULT_VENUE_SLUG=myrestaurant`
   - `STAFF_COOKIE_SECURE=true`
   - `STAFF_DEMO_PASSWORD` — strong password (not the local demo)
   - `PLATFORM_ADMIN_PASSWORD` — for `/platform` venue creation
   - VAPID keys + `VAPID_SUBJECT=mailto:push@qiktik.tech`
3. Add domain `qiktik.tech` in Vercel → DNS as instructed.
4. After first deploy: `npx prisma db push` and `npm run db:seed` (or seed-menu) against Neon if needed.
5. Smoke-test the demo URLs above; regenerate QR/NFC to `/r/myrestaurant/…`.

## Create another restaurant

1. Open `https://qiktik.tech/platform`
2. Enter platform password, name, slug, package
3. Open `/r/{slug}/admin` and manage menu / package
