import type { Venue } from "@prisma/client";

export type VenueBrand = {
  logoUrl: string | null;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
};

export const DEFAULT_VENUE_BRAND: VenueBrand = {
  logoUrl: null,
  accentColor: "#c4a35a",
  backgroundColor: "#0c110f",
  surfaceColor: "#141a17",
  textColor: "#f2efe8",
};

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

export function brandFromVenue(
  venue: Pick<
    Venue,
    | "logoUrl"
    | "accentColor"
    | "backgroundColor"
    | "surfaceColor"
    | "textColor"
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
  };
}

export function venueLogoSrc(brand: VenueBrand | null | undefined): string {
  return brand?.logoUrl?.trim() || "/logo.png";
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
