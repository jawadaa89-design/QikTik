# QikTik — Handoff

**Last updated:** November 19, 2026  
**Project:** QR + NFC table ordering  
**Demo venue:** **My Restaurant** (`my-restaurant`)  
**Workspace:** `C:\Users\USER\Desktop\QikTik`

> Copy the whole folder (or `git clone`). Open in Cursor. Paste `docs/CURSOR_CONTINUE_PROMPT.txt`. Do **not** rebuild from scratch.

---

## Packing list

| Must copy | Why |
|-----------|-----|
| Entire `src/` | App + API |
| Entire `prisma/` | Schema + seed |
| Entire `docs/` | This handoff + architecture |
| Entire `presentation/` | Mockups, pitches, slides AR+HE + `logo.png` |
| `public/logo.png` | Guest UI logo |
| `edge-server/` | Print queue + offline server |
| `package.json`, `package-lock.json`, `.env.example`, `.gitignore` | Tooling |

Regenerate locally: `.env`, `node_modules/`, `prisma/dev.db`, `.next/`

---

## Product decisions (locked)

| Topic | Decision |
|-------|----------|
| Scope | Single restaurant first |
| Currency | ₪ ILS |
| Languages | **ar → he → en → ru** (RTL for ar/he) |
| Theme | Metallic black + orange `#f97316` |
| Guest auth | Table session + passcode (register / unlock) |
| Payment | Pay-now + pay-at-end (card / cash via waiter) |
| Logo | Circular `logo.png` only |
| NFC | NTAG215 URL only |
| Stations | MAIN_KITCHEN · MEAT_KITCHEN · BAR · HOOKAH (printer only) |
| Sections | INSIDE · OUTSIDE · TERRACE |
| Tablets | 3 section + 1 manager |

---

## Current status (implemented)

### Guest
- Language chooser (large centered logo) · language switcher on registration  
- Register: name, phone, table password, **mandatory terms**, optional marketing (`Session.marketingOptIn`)  
- Unlock full-page · forgot password → call waiter · waiter reset passcode  
- Menu / cart / orders · unavailable items **dimmed, still listed**  
- Tip: none / typed % / fixed ₪ · leave table when unpaid = 0  
- Live updates via SSE  

### Kitchen (`/kitchen?station=`)
- KDS columns · tap to advance · **drag-and-drop** between RECEIVED / PREPARING / READY  
- Staff language switcher  

### Waiter (`/waiter?section=`)
- Floor colors (free / active / ready / call / bill) · no top alerts feed clutter  
- Cash/card + tip · bill history · print bill · reset guest password · close with confirm  
- Staff language switcher  

### Admin (`/admin`)
- Dashboard · **Menu:** edit / **add under category** / **remove** / image upload · edit locale AR/HE/EN/RU  
- Tables + guest URLs  
- Staff language switcher  

### Infra
- Prisma + SQLite demo · seed token `t_table7demo2026` (table 7) · venue `my-restaurant`  
- Stripe optional · edge server scaffold · `NEXT_PUBLIC_MENU_BASE_URL` for LAN phones  

### Not done / deferred
- Staff login gate (UI open for local demo)  
- Full production menu seed + all photos  
- Edge production deploy + programmed NTAG215 fleet  
- Public HTTPS domain  
- Loyalty v2  
- Category create/delete in admin UI  
- Soft-delete for ordered menu items (delete blocked with 409)  

---

## Demo URLs

| Role | URL |
|------|-----|
| Guest AR | http://localhost:3000/ar/t/t_table7demo2026 |
| Guest HE | http://localhost:3000/he/t/t_table7demo2026 |
| Guest EN | http://localhost:3000/en/t/t_table7demo2026 |
| Guest RU | http://localhost:3000/ru/t/t_table7demo2026 |
| Kitchen | http://localhost:3000/kitchen?station=MAIN_KITCHEN |
| Waiter | http://localhost:3000/waiter?section=INSIDE |
| Admin | http://localhost:3000/admin |

```powershell
npm install
npm run db:push
npm run db:seed
npm run dev
```

---

## Key code paths

| Area | Path |
|------|------|
| Guest gate / auth UI | `src/components/GuestAuthGate.tsx`, `GuestAuthProvider` |
| Guest lang persistence | `src/lib/guest-lang.ts` |
| Theme | `src/app/globals.css` |
| Locales order | `src/i18n/config.ts` |
| Staff i18n | `src/i18n/staff.ts` |
| Admin menu UI | `src/app/admin/page.tsx` |
| Admin menu API | `src/app/api/v1/admin/menu/route.ts` (+ `upload/`) |
| Kitchen | `src/app/kitchen/` |
| Waiter | `src/app/waiter/` |
| Seed | `prisma/seed.ts` |

---

## Presentations

Open under `presentation/` (requires `presentation/logo.png`):

- `pitch-slides-ar.html` / `pitch-slides-he.html` — 8 slides  
- `pitch-ar-onepage.html` / `pitch-he-onepage.html` — print handout  
- `mockups-restaurant-ar.html` / `mockups-restaurant-he.html` — UI mockups (metallic black + orange)  
- `mockups.html` — generic English reference  

See `presentation/README.md`.

---

## Screen inventory (live app)

| Area | Screens |
|------|---------|
| Guest | Language · Register (+ lang) · Unlock · Menu · Item · Cart · Orders · Tip/Pay · Leave |
| Kitchen | Station KDS (drag + tap) |
| Waiter | Floor · Table sheet (history, pay, reset passcode, close) |
| Admin | Dashboard · Menu (add/edit/remove) · Tables |

---

## Continue on another machine

1. Copy folder or clone.  
2. Paste `docs/CURSOR_CONTINUE_PROMPT.txt`.  
3. Ask for **incremental** tasks only.
