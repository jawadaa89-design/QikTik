import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";
import { resolveVenue } from "@/lib/venue";
import {
  brandFromVenue,
  normalizeHexColor,
  DEFAULT_VENUE_BRAND,
} from "@/lib/venue-brand";

export const dynamic = "force-dynamic";

const hex = z
  .string()
  .trim()
  .regex(/^#?[0-9a-fA-F]{6}$/, "Expected hex color like #c4a35a");

const optionalContact = z
  .string()
  .trim()
  .max(500)
  .nullable()
  .optional()
  .transform((v) => (v == null ? v : v === "" ? null : v));

const brandingSchema = z.object({
  accentColor: hex.optional(),
  backgroundColor: hex.optional(),
  surfaceColor: hex.optional(),
  textColor: hex.optional(),
  phone: z
    .string()
    .trim()
    .max(40)
    .nullable()
    .optional()
    .transform((v) => (v == null ? v : v === "" ? null : v)),
  wazeUrl: optionalContact,
  instagramUrl: optionalContact,
  facebookUrl: optionalContact,
  tiktokUrl: optionalContact,
  logoUrl: z
    .string()
    .trim()
    .refine(
      (v) =>
        v.startsWith("/") ||
        v.startsWith("http://") ||
        v.startsWith("https://"),
      "Expected absolute URL or /path"
    )
    .nullable()
    .optional(),
  heroImageUrl: z
    .string()
    .trim()
    .refine(
      (v) =>
        v.startsWith("/") ||
        v.startsWith("http://") ||
        v.startsWith("https://"),
      "Expected absolute URL or /path"
    )
    .nullable()
    .optional(),
});

/** GET /api/v1/admin/venue/branding — current venue branding. */
export async function GET(req: NextRequest) {
  const { requireStaffVenue } = await import("@/lib/staff-auth");
  const resolved = await requireStaffVenue(req);
  if ("error" in resolved) return resolved.error;
  const venue = resolved.venue;

  const branding = brandFromVenue(venue);
  return Response.json({
    branding,
    venue: {
      id: venue.id,
      name: venue.name,
      slug: venue.slug,
      branding,
    },
  });
}

/** PATCH /api/v1/admin/venue/branding — update colors, contact links, logoUrl. */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = brandingSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const { requireStaffVenue } = await import("@/lib/staff-auth");
  const resolved = await requireStaffVenue(req);
  if ("error" in resolved) return resolved.error;
  const venue = resolved.venue;

  const data: {
    accentColor?: string;
    backgroundColor?: string;
    surfaceColor?: string;
    textColor?: string;
    phone?: string | null;
    wazeUrl?: string | null;
    instagramUrl?: string | null;
    facebookUrl?: string | null;
    tiktokUrl?: string | null;
    logoUrl?: string | null;
    heroImageUrl?: string | null;
  } = {};

  if (parsed.data.accentColor != null) {
    data.accentColor = normalizeHexColor(
      parsed.data.accentColor.startsWith("#")
        ? parsed.data.accentColor
        : `#${parsed.data.accentColor}`,
      DEFAULT_VENUE_BRAND.accentColor
    );
  }
  if (parsed.data.backgroundColor != null) {
    data.backgroundColor = normalizeHexColor(
      parsed.data.backgroundColor.startsWith("#")
        ? parsed.data.backgroundColor
        : `#${parsed.data.backgroundColor}`,
      DEFAULT_VENUE_BRAND.backgroundColor
    );
  }
  if (parsed.data.surfaceColor != null) {
    data.surfaceColor = normalizeHexColor(
      parsed.data.surfaceColor.startsWith("#")
        ? parsed.data.surfaceColor
        : `#${parsed.data.surfaceColor}`,
      DEFAULT_VENUE_BRAND.surfaceColor
    );
  }
  if (parsed.data.textColor != null) {
    data.textColor = normalizeHexColor(
      parsed.data.textColor.startsWith("#")
        ? parsed.data.textColor
        : `#${parsed.data.textColor}`,
      DEFAULT_VENUE_BRAND.textColor
    );
  }
  if (parsed.data.logoUrl !== undefined) {
    data.logoUrl = parsed.data.logoUrl;
  }
  if (parsed.data.heroImageUrl !== undefined) {
    data.heroImageUrl = parsed.data.heroImageUrl;
  }
  if (parsed.data.phone !== undefined) {
    data.phone = parsed.data.phone;
  }
  if (parsed.data.wazeUrl !== undefined) {
    data.wazeUrl = parsed.data.wazeUrl;
  }
  if (parsed.data.instagramUrl !== undefined) {
    data.instagramUrl = parsed.data.instagramUrl;
  }
  if (parsed.data.facebookUrl !== undefined) {
    data.facebookUrl = parsed.data.facebookUrl;
  }
  if (parsed.data.tiktokUrl !== undefined) {
    data.tiktokUrl = parsed.data.tiktokUrl;
  }

  const updated = await prisma.venue.update({
    where: { id: venue.id },
    data,
  });

  return Response.json({
    ok: true,
    branding: brandFromVenue(updated),
  });
}
