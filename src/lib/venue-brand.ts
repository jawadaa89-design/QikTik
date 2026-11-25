import type { Venue } from "@prisma/client";

export type VenueBrand = {
  logoUrl: string | null;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  /** Guest contact / social — shown on digital menu when non-empty */
  phone: string | null;
  wazeUrl: string | null;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
};

export const DEFAULT_VENUE_BRAND: VenueBrand = {
  logoUrl: null,
  accentColor: "#c4a35a",
  backgroundColor: "#0c110f",
  surfaceColor: "#141a17",
  textColor: "#f2efe8",
  phone: null,
  wazeUrl: null,
  instagramUrl: null,
  facebookUrl: null,
  tiktokUrl: null,
};

/** tel: href from a display phone string */
export function phoneTelHref(phone: string | null | undefined): string | null {
  const raw = phone?.trim() || "";
  if (!raw) return null;
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned || cleaned === "+") return null;
  return `tel:${cleaned}`;
}

/** Absolute http(s) href, or null when empty / invalid. */
export function externalHref(value: string | null | undefined): string | null {
  const raw = value?.trim() || "";
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  // Reject javascript:/data: etc.
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  return `https://${raw.replace(/^\/+/, "")}`;
}

/**
 * Social profile URL from a full link or @handle / bare username.
 * `base` e.g. https://www.instagram.com
 * `handlePrefix` e.g. "@" for TikTok paths (`/@user`).
 */
export function socialProfileHref(
  value: string | null | undefined,
  base: string,
  handlePrefix = ""
): string | null {
  const raw = value?.trim() || "";
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("//")) {
    return externalHref(raw);
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return null;
  const handle = raw.replace(/^@+/, "").replace(/^\/+/, "").split(/[/?#]/)[0];
  if (!handle || !/^[a-zA-Z0-9._-]+$/.test(handle)) {
    return externalHref(raw);
  }
  return `${base.replace(/\/$/, "")}/${handlePrefix}${handle}`;
}

const HEX = /^#([0-9a-fA-F]{6})$/;

export function isHexColor(value: string): boolean {
  return HEX.test(value.trim());
}

export function normalizeHexColor(value: string, fallback: string): string {
  const v = value.trim();
  if (HEX.test(v)) return v.toLowerCase();
  if (/^[0-9a-fA-F]{6}$/.test(v)) return `#${v.toLowerCase()}`;
  return fallback;
}

function trimOrNull(value: string | null | undefined): string | null {
  const v = value?.trim() || "";
  return v || null;
}

export function brandFromVenue(
  venue: Pick<
    Venue,
    | "logoUrl"
    | "accentColor"
    | "backgroundColor"
    | "surfaceColor"
    | "textColor"
    | "phone"
    | "wazeUrl"
    | "instagramUrl"
    | "facebookUrl"
    | "tiktokUrl"
  > | null
    | undefined
): VenueBrand {
  if (!venue) return { ...DEFAULT_VENUE_BRAND };
  return {
    logoUrl: venue.logoUrl?.trim() || null,
    accentColor: normalizeHexColor(
      venue.accentColor,
      DEFAULT_VENUE_BRAND.accentColor
    ),
    backgroundColor: normalizeHexColor(
      venue.backgroundColor,
      DEFAULT_VENUE_BRAND.backgroundColor
    ),
    surfaceColor: normalizeHexColor(
      venue.surfaceColor,
      DEFAULT_VENUE_BRAND.surfaceColor
    ),
    textColor: normalizeHexColor(venue.textColor, DEFAULT_VENUE_BRAND.textColor),
    phone: trimOrNull(venue.phone),
    wazeUrl: trimOrNull(venue.wazeUrl),
    instagramUrl: trimOrNull(venue.instagramUrl),
    facebookUrl: trimOrNull(venue.facebookUrl),
    tiktokUrl: trimOrNull(venue.tiktokUrl),
  };
}

export function venueLogoSrc(brand: VenueBrand | null | undefined): string {
  return brand?.logoUrl?.trim() || "/logo.png";
}

/** Home-screen / PWA display name when saving the guest main link. */
export function venueHomeScreenName(venueName: string | null | undefined): string {
  const name = venueName?.trim() || "Restaurant";
  return `${name} QikTik`;
}

/** Chrome tab / PWA icons for the active restaurant logo. */
export function venueIconsMetadata(logoSrc: string): {
  icon: { url: string }[];
  apple: { url: string }[];
  shortcut: string;
} {
  const url = logoSrc.trim() || "/logo.png";
  return {
    icon: [{ url }],
    apple: [{ url }],
    shortcut: url,
  };
}

/** Raw <link> tags for SSR HTML boards (pickup / alerts). */
export function venueFaviconLinkTags(logoSrc: string): string {
  const href = escapeAttr(logoSrc.trim() || "/logo.png");
  return [
    `<link rel="icon" href="${href}" sizes="32x32" />`,
    `<link rel="icon" href="${href}" sizes="192x192" />`,
    `<link rel="apple-touch-icon" href="${href}" />`,
    `<link rel="shortcut icon" href="${href}" />`,
  ].join("\n  ");
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

/** Inline style object for themed wrappers (HTML boards / React). */
export function brandCssVars(brand: VenueBrand): Record<string, string> {
  return {
    "--brand-accent": brand.accentColor,
    "--brand-bg": brand.backgroundColor,
    "--brand-surface": brand.surfaceColor,
    "--brand-text": brand.textColor,
    "--color-brass": brand.accentColor,
    "--color-ink": brand.textColor,
    "--color-panel": brand.surfaceColor,
  };
}
