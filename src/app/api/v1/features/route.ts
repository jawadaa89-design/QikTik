import { NextRequest } from "next/server";
import { getActivePackage } from "@/lib/features";
import { resolveVenueFromRequest } from "@/lib/venue";

export const dynamic = "force-dynamic";

/** Public feature flags for the resolved venue (?venue=slug). */
export async function GET(req: NextRequest) {
  const venue = await resolveVenueFromRequest(req);
  const pkg = await getActivePackage(venue?.id);
  return Response.json({
    packageId: pkg.id,
    venueId: pkg.venueId,
    features: pkg.features,
  });
}
