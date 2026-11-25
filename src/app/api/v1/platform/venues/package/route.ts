import { NextRequest } from "next/server";
import { z } from "zod";
import {
  PACKAGE_PRESETS,
  setVenueFeatures,
  type PackageId,
} from "@/lib/features";
import { apiError } from "@/lib/validation";
import { platformPasswordOk } from "@/lib/platform-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const packageIds = Object.keys(PACKAGE_PRESETS) as PackageId[];

const schema = z.object({
  password: z.string().min(1),
  venueId: z.string().trim().min(1),
  packageId: z.enum(packageIds as [PackageId, ...PackageId[]]),
});

/** PATCH /api/v1/platform/venues/package — activate a package for a venue. */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  if (!platformPasswordOk(parsed.data.password)) {
    return apiError("UNAUTHORIZED", "Wrong platform password", 401);
  }

  const venue = await prisma.venue.findUnique({
    where: { id: parsed.data.venueId },
    select: { id: true, name: true, slug: true },
  });
  if (!venue) {
    return apiError("VENUE_NOT_FOUND", "Venue not found", 404);
  }

  try {
    const pkg = await setVenueFeatures(
      { packageId: parsed.data.packageId },
      venue.id
    );
    return Response.json({
      ok: true,
      venueId: venue.id,
      slug: venue.slug,
      name: venue.name,
      packageId: pkg.id,
      features: pkg.features,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "VENUE_NOT_FOUND") {
      return apiError("VENUE_NOT_FOUND", "Venue not found", 404);
    }
    throw e;
  }
}
