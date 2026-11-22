# Transfer checklist — QikTik to another laptop / Cursor account

**Last updated:** August 4, 2026

## Goal

Move the project so a new Cursor chat can continue without regenerating deliverables.

## Step 1 — Copy the project

Prefer **Git**:

```powershell
cd C:\Users\USER\Desktop\QikTik
git status
# commit / push if you use a remote
```

Or copy the whole folder to USB / OneDrive / zip:

```
QikTik\   ← entire directory
```

**Must include** binary logos:

- `presentation\logo.png` — pitches & mockups  
- `public\logo.png` — guest app  

## Step 2 — On the new laptop

1. Install **Node.js 20+ LTS**  
2. Clone or unzip `QikTik`  
3. Open folder in **Cursor**  
4. In PowerShell:

```powershell
cd <path>\QikTik
npm install
copy .env.example .env   # if .env missing; set NEXT_PUBLIC_MENU_BASE_URL to this PC's LAN IP for phones
npm run db:push
npm run db:seed
npm run dev
```

5. Verify guest: http://localhost:3000/ar/t/t_table7demo2026  
6. Verify staff: `/kitchen`, `/waiter`, `/admin`  
7. Open presentations: `presentation\pitch-slides-he.html` or `-ar.html`

## Step 3 — New Cursor chat

Paste:

`docs\CURSOR_CONTINUE_PROMPT.txt`

Then `@docs/CURSOR_HANDOFF.md` and state your next task.

## Step 4 — Verify outputs exist

- [ ] `docs/CURSOR_HANDOFF.md` (updated Aug 4, 2026)
- [ ] `docs/CURSOR_CONTINUE_PROMPT.txt`
- [ ] `docs/QUICKSTART.md`
- [ ] `docs/API.md`
- [ ] `docs/STATIONS.md`
- [ ] `docs/ARCHITECTURE.md`
- [ ] `prisma/seed.ts`
- [ ] `public/logo.png`
- [ ] `presentation/logo.png`
- [ ] `presentation/mockups-restaurant-ar.html` / `-he.html`
- [ ] `presentation/pitch-*-onepage.html` / `pitch-slides-*.html`
- [ ] Guest + kitchen + waiter + admin run against seed

## Important

- Chat history does **not** transfer across Cursor accounts — **files** are the source of truth.  
- Do **not** ask the new agent to create QikTik from scratch; ask it to **continue from the handoff**.
