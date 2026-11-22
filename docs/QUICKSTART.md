# Quick start — My Restaurant demo

## 1. Install & seed

```powershell
cd C:\Users\USER\Desktop\QikTik
npm install
npm run db:push
npm run db:seed
```

## 2. Run

```powershell
npm run dev
```

Optional edge server (print queue + socket.io):

```powershell
npm run edge:dev
```

## 3. Guest — table 7 (Inside)

Locale order in the app: **ar → he → en → ru**.

| Language | URL |
|----------|-----|
| **Arabic** | http://localhost:3000/ar/t/t_table7demo2026 |
| **Hebrew** | http://localhost:3000/he/t/t_table7demo2026 |
| English | http://localhost:3000/en/t/t_table7demo2026 |
| Russian | http://localhost:3000/ru/t/t_table7demo2026 |

**Token:** `t_table7demo2026`

On a phone (same Wi‑Fi), replace `localhost` with your PC IP (also set in `.env` as `NEXT_PUBLIC_MENU_BASE_URL`).

### Guest flow (current)

1. Large centered logo → language chooser  
2. Registration: name, phone, **table password**, mandatory terms (*), optional marketing (default on) · language switcher on this screen  
3. Menu / cart / orders · unavailable items stay visible but dimmed  
4. Tip (none / % / fixed ₪) · pay now or tab · leave table when unpaid = 0  
5. Return visit → full-page unlock · wrong password can call waiter · waiter can reset passcode  

## 4. Staff apps

Staff UI language is switchable (`ar` / `he` / `en` / `ru`).

| App | URL |
|-----|-----|
| Kitchen KDS | http://localhost:3000/kitchen?station=MAIN_KITCHEN |
| Meat kitchen | http://localhost:3000/kitchen?station=MEAT_KITCHEN |
| Bar | http://localhost:3000/kitchen?station=BAR |
| Waiter (Inside) | http://localhost:3000/waiter?section=INSIDE |
| Manager (all) | http://localhost:3000/waiter?section=ALL |
| Admin | http://localhost:3000/admin |

### Staff highlights

- **Kitchen:** tap advances status; **drag cards** between RECEIVED / PREPARING / READY  
- **Waiter:** strong table colors · bill history · cash/card + tip · reset guest password · close with confirm  
- **Admin → Menu:** per-category **Add item** · **Remove** (blocked if item was ordered before — use Off) · photo upload · edit text in AR/HE/EN/RU  

## What works

- Guest auth (register / unlock / leave) + 4-language menu/cart/orders + live SSE  
- Call waiter / request bill  
- Kitchen KDS with station filter + drag-and-drop  
- Waiter floor map, served, cash/card, tips, history, passcode reset, close  
- Admin dashboard, menu CRUD (create/edit/delete unused items), tables + guest URLs  
- Stripe: real PaymentIntent when `STRIPE_SECRET_KEY` is set; otherwise demo auto-complete for Pay now  
- Edge: `:4000` health/print, `:4001` socket.io  

## Seeded data

- Venue: **My Restaurant** (`my-restaurant`)  
- 26 tables (Inside 1–12, Outside 21–28, Terrace 31–36)  
- ~20 menu items (salads, meats, mains, drinks, hookah)  
- Staff users `@qiktik.local` (demo password `qiktik2026`) — unlock `/admin`, `/pickup`, `/kitchen`, `/waiter` with that password  

## Re-seed

```powershell
npm run db:seed
```

## Guest pickup Web Push (optional)

Background alerts when the waiting tab is closed use VAPID + a service worker. See [WEB_PUSH.md](./WEB_PUSH.md). Generate keys with `npx web-push generate-vapid-keys` and set `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` in `.env`.

**iPhone:** LAN `http://10.0.0.x` cannot do Web Push. Use HTTPS tunnel + Add to Home Screen — [IOS_PUSH.md](./IOS_PUSH.md) (`npm run dev:tunnel-hint`).

## Presentations / mockups

Open HTML under `presentation/` in a browser (keep `presentation/logo.png` beside them). See [presentation/README.md](../presentation/README.md).
