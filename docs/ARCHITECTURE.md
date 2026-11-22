# Architecture & Offline Sync

## Overview

QikTik runs in two deployment modes:

| Mode | Where | Use case |
|------|-------|----------|
| **Cloud** | Vercel + managed PostgreSQL | Dev, backup, remote admin |
| **Edge** | Mini PC / Raspberry Pi on venue LAN | Production — offline resilience |

Guests, kitchen, and waiters on venue Wi-Fi talk to the **edge server**. The edge server syncs to cloud when internet is available.

```
                    ┌─────────────┐
                    │   Cloud     │
                    │  PostgreSQL │
                    │  + Admin    │
                    └──────▲──────┘
                           │ sync (when online)
                    ┌──────┴──────┐
  Guest phones ────►│ Edge Server │◄──── Waiter tablet
  (NFC / QR)        │  LAN :4000  │◄──── Kitchen screen
                    │  SQLite/PG  │
                    └──────┬──────┘
                           │
                    ┌──────┴──────┐
                    │  Printers   │
                    │  ESC/POS    │
                    └─────────────┘
```

---

## Hardware

### Table stand (per table)
- **NTAG215** NFC sticker programmed with venue table URL (see [NFC tags setup guide](#nfc-tags-setup-guide))
- **QR code** encoding the same URL (backup if NFC fails or phone is older)
- Stand PDF generated from admin panel (4 languages)

For production tags, program a **full guest URL with locale**, e.g.:

`https://menu.yourvenue.com/ar/t/{token}`

(Demo token: `t_table7demo2026` → `/{locale}/t/t_table7demo2026`.) One unique token per table (~55–75 tags + spares). Guests can still change language in-app after open.

### Edge server (one per venue)
- **Raspberry Pi 4** (4GB+) or Intel NUC
- Ethernet to router (preferred over Wi-Fi)
- USB thermal printer(s): kitchen + optional bar
- UPS recommended for power cuts

### Staff devices
- Kitchen: 24" touchscreen or tablet (landscape)
- Waiter: 10" tablet (portrait)
- Admin: any PC browser

---

## NFC tags setup guide

### Recommended chip

| Spec | Choice |
|------|--------|
| **Chip** | **NTAG215** (NXP, NFC Forum Type 2) |
| **User memory** | 504 bytes — enough for a full HTTPS URL with a long opaque token |
| **Data stored** | **URL only** — no payment info, no customer data |
| **Why not NTAG213** | 144 bytes — too tight for `https://` + 24+ char token |
| **Why not MIFARE Classic** | Poor iPhone support; not designed for opening URLs |
| **Why not NTAG424 DNA** | Optional later for anti-cloning; unnecessary for v1 |

Each tag opens the guest menu in the phone browser — **no app install** required.

### Physical tag format (demo venue)

| Location | Tag type | Notes |
|----------|----------|-------|
| **Inside** (wood / laminate tables) | 25–30 mm **epoxy NFC sticker** | Stick under “Tap NFC” on printed stand |
| **Outside / Terrace** | **Waterproof epoxy** (IP65+) | Heat, spills, rain |
| **Metal tables** | **On-metal** NTAG215 sticker | Standard tags do not work on metal — need ferrite backing |
| **Stand mount** | Tag on **acrylic/PVC stand**, not directly on wet table surface | Easier to replace; less wear |

**Quantity:** one tag per table + **~10 spares** (lost, damaged, reprogram after table renumber).

### URL format (what to write)

Program each tag with the **same URL as the QR code** on that table’s stand:

```
https://menu.yourvenue.com/ar/t/{token}
```

Include a default locale (`ar` recommended for this demo). Guests can switch language in-app (`ar` → `he` → `en` → `ru`). Demo: `/ar/t/t_table7demo2026`.

Rules:
- `{token}` = opaque random string from admin (24+ chars) — **not** table number `7`
- One URL per table, forever (unless table is replaced — then reprogram spare)
- Store `nfcTagId` (tag UID) in admin when provisioning — see `Table.nfcTagId` in schema

Example record in admin:

| Table | Section | Token | NFC UID |
|-------|---------|-------|---------|
| 7 | INSIDE | `t_k8m2x9f...` | `04:A1:B2:C3:D4:E5:F6` |

### Programming (phone — NXP TagWriter)

Free app: **NXP TagWriter** (iOS / Android).

1. Create all tables in admin → export or copy each table URL
2. Open TagWriter → **Write** → **New dataset**
3. Add record → **Link** → paste full URL
4. **Write** — hold phone on blank tag until success
5. **Optional but recommended:** TagWriter → **Configure** → set tag **read-only** (lock)
6. Tap tag with a second phone → confirm Safari/Chrome opens correct table
7. Log tag UID in admin (`nfcTagId`) and label stand physically (e.g. “T07 INSIDE” on back)

### Programming (USB writer — bulk)

For 50+ tags, use a desktop NFC writer (~$15–30 USB, or ACR122U-class reader).

1. Generate CSV from admin: `table_id, url, section`
2. Write **NDEF URI record** per tag (not plain text)
3. Lock tag after write (vendor tool or libnfc — chip-specific)
4. Export UID list back to admin for `nfcTagId` mapping

Tools: vendor software bundled with writer, **GoToTags**, or custom script with **libnfc**.

### Phone compatibility

| Device | NFC tap behavior |
|--------|------------------|
| **Android** (most) | Opens URL in default browser |
| **iPhone XS and newer** | Background Tag Reading → Safari |
| **Older iPhones / NFC off** | Guest uses **QR on same stand** |

Always print QR on the stand — NFC is convenience, QR is universal fallback.

### Supplier checklist

When ordering, confirm:

- [ ] Chip is **genuine NXP NTAG215** (avoid unbranded “215 compatible” for production)
- [ ] **NDEF pre-format** or blank Type 2 (both work; blank is fine)
- [ ] Correct form: **standard sticker** vs **on-metal** vs **waterproof outdoor**
- [ ] Size **25–30 mm** round fits stand artwork
- [ ] Adhesive rated for restaurant use (3M or equivalent)
- [ ] Order **~10% spares**

Search terms: `NTAG215 NFC sticker 25mm`, `NTAG215 on metal tag`, `NTAG215 waterproof NFC tag`.

Suggested suppliers (verify chip authenticity): NXP partners, GoToTags, Smartrac/Identiv distributors, or reputable Amazon/B2B NFC shops — avoid the cheapest unlabeled bulk for a live venue.

### Install on stand

```
┌─────────────────────┐
│   [Venue logo]      │
│   ┌─────────────┐   │
│   │  QR code    │   │  ← same URL as NFC
│   └─────────────┘   │
│    ( Tap NFC )      │  ← NTAG215 hidden behind/acrylic
│      Table 7        │
└─────────────────────┘
```

1. Program tag **before** sticking — test every tag once
2. Place tag behind “Tap NFC” circle or inside acrylic layer
3. Do not stack metal plate over tag
4. Keep tag flat — bends reduce read range

### Testing checklist (per tag)

- [ ] Tap with **Android** → correct table URL opens
- [ ] Tap with **iPhone** → Safari opens same URL
- [ ] URL matches QR on that stand
- [ ] Wrong table’s tag does **not** open this table’s session
- [ ] Tag UID recorded in admin
- [ ] Tag locked (read-only) if your workflow supports lock

### Security

| Rule | Reason |
|------|--------|
| URL only on tag | No PCI scope; no secrets on physical media |
| Opaque token in URL | Table numbers are guessable; tokens are not |
| Lock tag after program | Prevents malicious URL swap |
| HTTPS only | Required for modern mobile NFC URL handlers |

See also [Security](#security) table — NFC row.

---

## Network

| Service | Port | Access |
|---------|------|--------|
| Edge HTTP API | 4000 | Venue LAN only |
| WebSocket | 4001 | Venue LAN only |
| Print daemon | 4002 | Localhost on edge |
| Next.js (dev) | 3000 | Dev only |

**DNS (optional):** `menu.goldenpub.local` → edge server IP via router DNS or mDNS.

**Guest URL strategy:**
- Production: `https://menu.yourvenue.com` with DNS failover to edge IP
- LAN fallback: edge serves same app; health check routes guests to local when cloud down

---

## Offline behavior

### Always works on LAN (no internet)
- Guest browse menu (cached)
- Guest submit orders
- Kitchen receive orders + update status
- Guest see order progress (WebSocket on LAN)
- Waiter floor map + cash payments
- Thermal print

### Requires internet
- Stripe card payments
- Cloud admin dashboard (unless admin on LAN)
- Cross-venue analytics backup

### Degraded mode UX
When edge detects no upstream internet:
1. Guest app shows banner: *Card payments unavailable — pay cash to waiter*
2. `POST .../payments` returns `402 PAYMENT_OFFLINE`
3. Orders and cash payments queue in local DB
4. SyncLog records all mutations

When internet returns:
1. Edge pushes `SyncLog` batch to cloud (`POST /api/v1/sync/push`)
2. Edge pulls menu/settings changes (`GET /api/v1/sync/pull`)
3. Stripe webhook reconciles any pending payment intents

---

## Sync protocol

### Outbound (edge → cloud)

Every mutation on edge writes a `SyncLog` row:

```typescript
{
  entityType: "ORDER",
  entityId: "clx...",
  operation: "CREATE",
  payload: { /* full entity snapshot */ },
  syncedAt: null
}
```

Edge cron (every 30s when online):
1. Query `SyncLog WHERE syncedAt IS NULL LIMIT 100`
2. POST batch to cloud
3. Cloud upserts entities, returns `{ synced: ["id1","id2"] }`
4. Edge sets `syncedAt = now()`

**Conflict resolution:** Last-write-wins by `updatedAt`. Menu edits from admin always originate in cloud → edge pull overwrites local menu cache.

### Inbound (cloud → edge)

Edge pulls every 60s (or on webhook ping):
- `GET /api/v1/sync/pull?since=2026-07-13T01:00:00Z`
- Applies menu category/item upserts
- Applies venue settings changes
- Does NOT overwrite open orders/sessions

---

## Print pipeline

```
Order submitted
  → edge-server/print/queue.ts
  → ESC/POS formatter (table #, items, notes, timestamp, route)
  → USB printer (kitchen) or network printer (bar filter)
  → Retry 3× on failure; alert admin if all fail
```

Bar items (`route: BAR`) route to bar printer; kitchen items to kitchen printer.

---

## Security

| Concern | Mitigation |
|---------|------------|
| Guessable table URLs | Opaque `token` (24+ char random) |
| Session hijack | Session bound to table token at creation |
| Staff API | JWT + role checks per route |
| Edge on LAN | No public port forwarding; firewall blocks WAN |
| Stripe | PCI via Stripe Elements; no card data stored |
| NFC | URL only; no payment data on tag |

---

## Deployment checklist

### Edge server setup
1. Install Node 20, clone QikTik
2. Set `DEPLOYMENT_MODE=edge` in `.env`
3. `npm install && npm run db:push`
4. Seed venue, tables, menu
5. Configure printers in `edge-server/print/config.json`
6. Run `npm run edge:dev` as systemd service
7. Program NFC tags — see [NFC tags setup guide](#nfc-tags-setup-guide)
8. Print stand PDFs from admin

### Cloud setup
1. Deploy Next.js to Vercel
2. PostgreSQL on Railway/Supabase
3. Set `DEPLOYMENT_MODE=cloud`
4. Configure Stripe webhooks
5. Point edge `CLOUD_SYNC_URL` to production API

---

## Future: loyalty (v2)

`Member` table and nullable `session.memberId` are already in schema. Flow:
1. Guest taps "Join club" at checkout
2. SMS verification → link session to member
3. Points credited on `Payment.status = COMPLETED`
4. Synced same as other entities via `SyncLog`
