import { NextRequest } from "next/server";
import { z } from "zod";
import {
  PACKAGE_PRESETS,
  getActivePackage,
  setVenueFeatures,
  type PackageId,
} from "@/lib/features";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

const packageIds = Object.keys(PACKAGE_PRESETS) as PackageId[];

const patchSchema = z.union([
  z.object({
    packageId: z.enum(
      packageIds as [PackageId, ...PackageId[]]
    ),
  }),
  z.object({
    ordering: z.boolean(),
    pickup: z.boolean(),
  }),
]);

export async function GET(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const { resolveVenueFromRequest } = await import("@/lib/venue");
  const venue = await resolveVenueFromRequest(req);
  const pkg = await getActivePackage(venue?.id);
  return Response.json({
    packageId: pkg.id,
    venueId: pkg.venueId,
    features: pkg.features,
    presets: packageIds.map((id) => ({
      id,
      features: PACKAGE_PRESETS[id].features,
    })),
  });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  try {
    const { resolveVenueFromRequest } = await import("@/lib/venue");
    const venue = await resolveVenueFromRequest(req);
    const pkg = await setVenueFeatures(parsed.data, venue?.id);
    return Response.json({
      packageId: pkg.id,
      venueId: pkg.venueId,
      features: pkg.features,
    });
  } catch (e) {
    if (e instanceof Error && e.message === "VENUE_NOT_FOUND") {
      return apiError("VENUE_NOT_FOUND", "No venue configured", 404);
    }
    throw e;
  }
}
