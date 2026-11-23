/**
 * Client-safe venue defaults (no Prisma / Node imports).
 * Override with NEXT_PUBLIC_DEFAULT_VENUE_SLUG or DEFAULT_VENUE_SLUG.
 * Production demo restaurant: https://app.qiktik.tech/r/myrestaurant
 */
export const DEFAULT_VENUE_SLUG =
  process.env.NEXT_PUBLIC_DEFAULT_VENUE_SLUG?.trim() ||
  process.env.DEFAULT_VENUE_SLUG?.trim() ||
  "myrestaurant";
