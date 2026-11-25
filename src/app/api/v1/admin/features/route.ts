import { NextRequest } from "next/server";
import {
  PACKAGE_PRESETS,
  getActivePackage,
  type PackageId,
} from "@/lib/features";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

const packageIds = Object.keys(PACKAGE_PRESETS) as PackageId[];

/** GET /api/v1/admin/features — current package (read-only for venue admins). */
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

/**
 * Venue admins cannot activate packages — request via email; platform activates.
 */
export async function PATCH() {
  return apiError(
    "FORBIDDEN",
    "Package changes are activated by QikTik. Select a package in Admin and email jawadaa@qiktik.tech.",
    403
  );
}
