# PostgreSQL setup (QikTik)

QikTik now targets **PostgreSQL** (SaaS / multi-venue). SQLite `prisma/dev.db` is legacy local-only.

## Local with Docker

```bash
docker compose up -d
```

Set in `.env`:

```env
DATABASE_URL="postgresql://qiktik:qiktik@localhost:5432/qiktik?schema=public"
DEFAULT_VENUE_SLUG="my-restaurant"
NEXT_PUBLIC_DEFAULT_VENUE_SLUG="my-restaurant"
```

Then:

```bash
npx prisma generate
npx prisma db push
npm run db:seed
npm run dev
```

## Without Docker

Use any Postgres 14+ instance (Neon, Supabase, Railway, local install) and set `DATABASE_URL` accordingly, then `db push` + `db:seed`.

### Quick Neon (no local install)

```bash
# Creates a claimable DB (expires in 72h unless claimed)
curl -s -X POST https://neon.new/api/v1/database \
  -H "Content-Type: application/json" \
  -d "{\"ref\":\"QikTik\"}"
```

Put the returned `connection_string` in `.env` as `DATABASE_URL` (prefer the non-`-pooler` host for Prisma `db push`). Claim via the returned `claim_url` to keep it.

## Venue resolution (B1/B2)

APIs resolve the venue via (in order):

1. `id` when known  
2. `?venue=` / `?venueSlug=` query  
3. `x-venue-slug` header  
4. body `venueSlug` (where schemas allow it)  
5. `DEFAULT_VENUE_SLUG` / `NEXT_PUBLIC_DEFAULT_VENUE_SLUG` (default `my-restaurant`)  
6. Oldest venue (legacy single-venue fallback)

Helper: `src/lib/venue.ts` → `resolveVenueFromRequest` / `requireVenue`.
