# QikTik

QR + NFC table ordering for restaurants and pubs. Demo venue: **My Restaurant**.

## Languages

Guest & staff UI: **Arabic → Hebrew → English → Russian** (`ar` · `he` · `en` · `ru`). RTL for `ar` and `he`.

## Theme

Metallic black surfaces with **orange** accents (`#f97316`). Currency: **₪ ILS**.

## Quick start (My Restaurant demo)

```bash
npm install
npm run db:push
npm run db:seed
npm run dev
```

| Role | URL |
|------|-----|
| Guest table 7 | http://localhost:3000/ar/t/t_table7demo2026 |
| Kitchen | http://localhost:3000/kitchen?station=MAIN_KITCHEN |
| Waiter | http://localhost:3000/waiter?section=INSIDE |
| Admin | http://localhost:3000/admin |

Phone on the same Wi‑Fi: use your PC LAN IP (see `NEXT_PUBLIC_MENU_BASE_URL` in `.env`), e.g. `http://10.0.0.30:3000/ar/t/t_table7demo2026`.

Full steps: [docs/QUICKSTART.md](./docs/QUICKSTART.md)

## What’s included

- **Guest:** language pick → register (table password, terms, optional marketing) → menu / cart / orders → tip + pay → unlock on return · leave table when unpaid is 0 · dimmed unavailable items
- **Pickup notifications (MVP):** guest registers name at `/[locale]/pickup` → waiting screen (SSE + poll) → staff marks ready on `/pickup` → browser notification when permitted. No live POS yet — a future POS webhook can POST `orderRef` into `POST /api/v1/pickup`.
- **Kitchen KDS:** station filter · tap or **drag-and-drop** between New / Preparing / Ready
- **Waiter:** floor map · cash/card · tips · bill history · reset guest password · close table
- **Admin:** dashboard · menu editor (edit / **add** / **remove** / photo upload · 4 edit languages) · tables + guest URLs
- Staff apps are **multi-language** (same `ar/he/en/ru` order)

## Docs

- [Quick start](./docs/QUICKSTART.md)
- [Handoff / conversation export](./docs/CURSOR_HANDOFF.md)
- [Transfer checklist](./docs/TRANSFER_CHECKLIST.md)
- [Continue prompt](./docs/CURSOR_CONTINUE_PROMPT.txt)
- [Architecture & NFC](./docs/ARCHITECTURE.md)
- [API reference](./docs/API.md)
- [Stations & hardware](./docs/STATIONS.md)
- [Presentations & mockups](./presentation/README.md)

## Project structure

```
src/
  app/           Next.js routes (guest, staff, admin, API)
  components/    UI components
  i18n/          next-intl + staff messages
  lib/           DB, sync, payments, validation
edge-server/     Local LAN server (print + socket.io)
prisma/          Schema + My Restaurant seed
docs/            Architecture, API, handoff
presentation/    Pitch slides, one-pagers, UI mockups
```
