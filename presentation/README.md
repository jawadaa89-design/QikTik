# QikTik presentation files

**Updated:** November 19, 2026 — metallic black UI, orange `#f97316`, locale order **ar → he → en → ru**, demo venue **My Restaurant**.

Keep **`logo.png`** in this folder — all HTML files load the circular venue logo from it (`public/logo.png` is used by the live app).

There are no separate PNG screenshots in the repo: these HTML phone frames **are** the visual screenshots for sales. Capture with Win+Shift+S or Ctrl+P → PDF if needed.

## Arabic (عربي)

| File | Use |
|------|-----|
| **`pitch-ar-onepage.html`** | 1-page owner pitch — print / PDF |
| **`pitch-slides-ar.html`** | 8 slides — ← → to navigate |
| **`mockups-restaurant-ar.html`** | Full UI mockups (guest · kitchen · waiter · admin) |

## Hebrew (עברית)

| File | Use |
|------|-----|
| **`pitch-he-onepage.html`** | 1-page owner pitch — print / PDF |
| **`pitch-slides-he.html`** | 8 slides — ← → to navigate |
| **`mockups-restaurant-he.html`** | Full UI mockups |

## English (generic)

| File | Use |
|------|-----|
| **`architecture-onepage.html`** | 1-page architecture · design · diagram · stack |
| `mockups.html` | Generic English wireframe mockups (reference) |

## Suggested meeting flow

1. Present **`pitch-slides-he.html`** or **`pitch-slides-ar.html`** (match the owner’s language)  
2. Leave the matching **one-page** PDF  
3. Show screens from **`mockups-restaurant-he.html`** / **`-ar.html`**  
4. Optionally open the live demo: `http://localhost:3000/ar/t/t_table7demo2026`

## Mockup screens (current)

- Guest: language (large logo) · registration + language switch · menu (dimmed unavailable) · cart / tip / pay · unlock  
- Kitchen: KDS columns (tap / drag in live app)  
- Waiter: floor · cash · history / reset passcode (live app)  
- Admin: dashboard · **add / edit / remove** menu items · tables + guest URL  

## Export

- **PDF:** open file → Ctrl+P → Save as PDF  
- **Screenshots:** Win+Shift+S on each phone frame  
