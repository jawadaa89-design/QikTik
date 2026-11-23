/**
 * Guest digital menu (pickup / browse) lives at `/{locale}/menu` — no table token.
 * Table QR ordering still uses `/{locale}/t/{token}`.
 * In-app links stay **same-origin relative** so a guest on a Cloudflare HTTPS
 * tunnel is not bounced to `NEXT_PUBLIC_MENU_BASE_URL` (often a LAN http://IP).
 * Absolute venue host is only for QR/print via `getPublicBaseUrl`.
 */
export const DEMO_TABLE_TOKEN =
  process.env.NEXT_PUBLIC_DEMO_TABLE_TOKEN ?? "t_table7demo2026";

export function guestDigitalMenuPath(locale: string): string {
  return `/${locale}/menu`;
}

/** Always same-origin relative — never hardcode LAN / MENU_BASE_URL. */
export function guestDigitalMenuHref(locale: string): string {
  return guestDigitalMenuPath(locale);
}
