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

const brandingSchema = z.object({
  accentColor: hex.optional(),
  backgroundColor: hex.optional(),
  surfaceColor: hex.optional(),
  textColor: hex.optional(),
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
});

/** GET /api/v1/admin/venue/branding — current venue branding. */
export async function GET(req: NextRequest) {
  const denied = await requireStaffSession(req);
  if (denied) return denied;

  const venue = await resolveVenue({ req });
  if (!venue) return apiError("VENUE_NOT_FOUND", "Venue not found", 404);

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

/** PATCH /api/v1/admin/venue/branding — update colors (and optional logoUrl). */
export async function PATCH(req: NextRequest) {
  const denied = await requireStaffSession(req);
  if (denied) return denied;

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

  const venue = await resolveVenue({ req });
  if (!venue) return apiError("VENUE_NOT_FOUND", "Venue not found", 404);

  const data: {
    accentColor?: string;
    backgroundColor?: string;
    surfaceColor?: string;
    textColor?: string;
    logoUrl?: string | null;
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

  const updated = await prisma.venue.update({
    where: { id: venue.id },
    data,
  });

  return Response.json({
    ok: true,
    branding: brandFromVenue(updated),
  });
}
