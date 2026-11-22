/**
 * Client-safe venue defaults (no Prisma / Node imports).
 * Override with NEXT_PUBLIC_DEFAULT_VENUE_SLUG or DEFAULT_VENUE_SLUG.
 */
export const DEFAULT_VENUE_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_VENUE_SLUG?.trim() ||
  process.env.DEFAULT_VENUE_SLUG?.trim() ||
  "my-restaurant";
