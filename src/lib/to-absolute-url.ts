/** Resolve a relative or absolute href to a full URL for QR / share. */
export function toAbsoluteUrl(href: string, origin?: string): string {
  const raw = href.trim();
  if (!raw) return origin || "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base =
    origin ||
    (typeof window !== "undefined" ? window.location.origin : "") ||
    "https://app.qiktik.tech";
  if (raw.startsWith("/")) return `${base.replace(/\/$/, "")}${raw}`;
  return `${base.replace(/\/$/, "")}/${raw}`;
}
