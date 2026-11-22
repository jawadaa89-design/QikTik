# QikTik API Reference

Base URL: `/api/v1`  
**Auth note (local demo):** staff UI + staff APIs require a staff session cookie from `POST /api/v1/staff/unlock` (demo password `qiktik2026`). Guest routes use table `token` (+ session passcode where noted).

Venue demo token: `t_table7demo2026` · locales: `ar` | `he` | `en` | `ru`

---

## Health & sync

### `GET /api/v1/health`
Edge/cloud health probe.

### `POST /api/v1/sync/push` · `GET /api/v1/sync/pull?since=`
Edge ↔ cloud sync batch (when deployed in dual mode).

### `GET /api/v1/events`
Server-Sent Events stream for live staff/guest updates.

---

## Guest — table

### `GET /api/v1/tables/:token`
Resolve table + open session summary.

### `POST /api/v1/tables/:token/alerts`
Call waiter / request bill / forgot password, etc.

**Body (example):** `{ "type": "CALL_WAITER" | "REQUEST_BILL" | …, "reason": "forgot_password" }`

### `POST /api/v1/tables/:token/orders`
Place order from cart (`paymentMode`, line items, tip fields).

### `GET /api/v1/tables/:token/orders?locale=`
Current visit orders + progress (not closed sessions).

### `POST /api/v1/tables/:token/pay`
Pay remaining tab by card (optional tip). Stripe when configured.

### `POST /api/v1/tables/:token/close`
Guest **leave table** when unpaid balance is `0`.

---

## Guest — auth (table password)

### `GET /api/v1/tables/:token/auth`
```json
{
  "needsRegistration": true,
  "needsUnlock": false,
  "tableNumber": 7,
  "sessionId": null,
  "guestName": null,
  "passcodeReset": false
}
```

### `POST /api/v1/tables/:token/auth/register`
Create/open session with name, phone, passcode, terms acceptance, marketing opt-in.

### `POST /api/v1/tables/:token/auth/unlock`
Unlock existing session with table passcode.

---

## Menu (public)

### `GET /api/v1/menu?locale=ar`
Categories + items. Unavailable items are **included** with `"available": false` (guest UI dims them).

`route`: `MAIN_KITCHEN` | `MEAT_KITCHEN` | `BAR` | `HOOKAH`

---

## Sessions (legacy / shared helpers)

### `GET /api/v1/sessions/:sessionId`
Session summary.

### `POST /api/v1/sessions/:sessionId/orders`
Alternate order submit path used by some clients.

---

## Kitchen

### `GET /api/v1/kitchen/orders?locale=&station=`
Queue for a station (`MAIN_KITCHEN` | `MEAT_KITCHEN` | `BAR` | …).

### `PATCH /api/v1/kitchen/orders/:orderId/items/:itemId`
Update line status — used by tap advance and **drag-and-drop**.

**Body:** `{ "status": "RECEIVED" | "PREPARING" | "READY" | "SERVED" }`

---

## Waiter

### `GET /api/v1/waiter/tables?section=INSIDE|OUTSIDE|TERRACE|ALL`
Floor map statuses and amounts.

### `GET /api/v1/waiter/tables/:tableId`
Open session detail + orders.

### `GET /api/v1/waiter/tables/:tableId/history`
**Bill history** for the table.

### `POST /api/v1/waiter/tables/:tableId/cash`
Record cash payment (amount, tip, close options).

### `POST /api/v1/waiter/tables/:tableId/card`
Record / complete card payment path for waiter.

### `POST /api/v1/waiter/tables/:tableId/bill`
Request / prepare bill.

### `POST /api/v1/waiter/tables/:tableId/print-bill`
Enqueue bill print.

### `POST /api/v1/waiter/tables/:tableId/orders`
Waiter-assisted order actions (e.g. mark served).

### `POST /api/v1/waiter/tables/:tableId/reset-passcode`
Clear guest table password so they can register again (after forgot-password call).

### `POST /api/v1/waiter/tables/:tableId/close`
Close session and free table (UI confirms first).

### `GET /api/v1/waiter/alerts`
Unread alerts (call, bill, ready, forgot password, …).

---

## Admin

### `GET /api/v1/admin/dashboard`
Today revenue, order count, open tables, recent feed.

### `GET /api/v1/admin/menu?locale=`
Categories with items + all translations.

### `POST /api/v1/admin/menu`
**Create** menu item under a category.

**Body**
```json
{
  "categoryId": "...",
  "price": "52",
  "route": "MAIN_KITCHEN",
  "available": true,
  "translations": {
    "ar": { "name": "تبولة", "description": "…" }
  }
}
```

### `PATCH /api/v1/admin/menu`
Update item: price, availability, route, `imageUrl`, translations.

**Body:** `{ "itemId": "...", "price": "…", "available": true, "translations": { … } }`

### `DELETE /api/v1/admin/menu`
Remove item. **409 `IN_USE`** if any `OrderItem` references it — turn **Off** instead.

**Body:** `{ "itemId": "..." }`

### `POST /api/v1/admin/menu/upload`
Multipart upload (`itemId` + `file`) → `public/uploads/menu/…` · returns `{ imageUrl }`.

### `GET /api/v1/admin/tables`
Tables with tokens and guest URLs (`/{locale}/t/{token}`).

---

## Real-time

| Mechanism | Port / path | Notes |
|-----------|-------------|--------|
| SSE | `/api/v1/events` | Used by Next staff/guest live hooks |
| Socket.io | edge `:4001` | Print + optional live when edge running |

---

## Pickup / order-ready notifications (MVP)

QikTik-native flow (no POS API wired yet). Guests register on `/[locale]/pickup`; staff manage `/pickup`.

### `POST /api/v1/pickup`
Register a waiting pickup ticket. Server assigns a short unique `orderRef` (2-digit ticket #, e.g. `42`).

**Body:** `{ "customerName": "…", "phone?": "…", "venueSlug?": "my-restaurant" }`

### `POST /api/v1/pickup/lookup`
Reconnect to an active WAITING/READY ticket. Tries `customerName` first (trim, case-insensitive; most recent wins). If no name match and `orderRef` is provided, looks up by assigned ticket #. If no name match and no `orderRef`, returns `404` with `NAME_NOT_FOUND_TICKET_REQUIRED`. If neither matches, returns `404` with `NOT_FOUND`.

**Body:** `{ "customerName": "…", "orderRef?": "…", "venueSlug?": "my-restaurant" }`

### `POST /api/v1/pickup/call-waiter`
Landing “call a waiter” (assistance queue). Server assigns `orderRef` like `W-12`.

**Body:** `{ "customerName": "…", "comment?": "…", "venueSlug?": "my-restaurant" }`

### `GET /api/v1/pickup?venue=&status=WAITING,READY`
Staff queue list.

### `GET /api/v1/pickup/:id`
Guest status poll / waiting page.

### `PATCH /api/v1/pickup/:id`
**Body:** `{ "status": "READY" | "COMPLETED" | "CANCELLED" | "WAITING" }`  
Publishes SSE `pickup:updated`.

---

## Error format

```json
{
  "error": {
    "code": "TABLE_NOT_FOUND",
    "message": "Invalid table token"
  }
}
```

| HTTP | Examples |
|------|----------|
| 400 | `VALIDATION_ERROR`, `NO_SESSION`, `NOTHING_DUE` |
| 402 | `PAYMENT_OFFLINE` |
| 404 | `TABLE_NOT_FOUND`, `NOT_FOUND` |
| 409 | `IN_USE` (menu item delete blocked) |
