# QikTik website screenshots

Polished product screenshots for the QikTik demo venue **My Restaurant**.

- **Base URL:** `http://localhost:3000`
- **Guest demo:** `/en/t/t_table7demo2026` (Table 7)
- **Viewport:** 1440×900 desktop (guest UI is phone-width by design, centered)

## Files

| File | Caption |
|------|---------|
| `01-guest-language.png` | Guest entry — My Restaurant branding and multilingual language picker (Table 7). |
| `02-guest-menu.png` | Guest digital menu — header, search, categories, and salad items. |
| `03-guest-menu-items.png` | Guest menu on the Meats category with item cards and prices. |
| `04-guest-item-sheet.png` | Item sheet — takeaway, notes, quantity, and add-to-cart. |
| `05-guest-cart.png` | Guest cart with dishes, total, pay preference, and place-order CTA. |
| `06-guest-orders.png` | Guest orders — live kitchen progress and tip / pay bill. |
| `07-waiter-floor.png` | Waiter floor — live table grid with Table 7 active. |
| `08-waiter-table.png` | Waiter table detail — guest, tab balance, and staff actions. |
| `09-kitchen.png` | Kitchen display — New / Preparing / Ready ticket columns. |
| `10-admin.png` | Admin dashboard — KPIs and live feed for My Restaurant. |
| `11-admin-menu.png` | Admin menu management — categories, items, and availability. |

## Re-capture

```bash
cd website-screenshots
npm install
node capture.mjs
```

Requires the Next.js app running on port 3000.
