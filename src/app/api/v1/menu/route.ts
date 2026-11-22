import { NextRequest } from "next/server";
import { getMenuForVenue, getTableByToken } from "@/lib/menu-service";
import type { Locale } from "@/i18n/config";
import { apiError } from "@/lib/validation";
import { resolveVenueFromRequest } from "@/lib/venue";

export async function GET(req: NextRequest) {
  const locale = (req.nextUrl.searchParams.get("locale") ?? "ar") as Locale;

  const tableToken = req.nextUrl.searchParams.get("table");
  let venueId: string | undefined;

  if (tableToken) {
    const table = await getTableByToken(tableToken);
    if (!table) return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);
    venueId = table.venueId;
  } else {
    const venue = await resolveVenueFromRequest(req);
    if (!venue) return apiError("VENUE_NOT_FOUND", "Venue not found", 404);
    venueId = venue.id;
  }

  const categories = await getMenuForVenue(venueId, locale);

  return Response.json({ categories });
}
