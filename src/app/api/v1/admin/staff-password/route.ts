import { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/validation";
import { requireStaffSession, setVenueStaffPassword } from "@/lib/staff-auth";
import { resolveVenue } from "@/lib/venue";

export const dynamic = "force-dynamic";

const schema = z.object({
  password: z.string().trim().min(4).max(72),
});

/** PATCH /api/v1/admin/staff-password — set this venue’s staff unlock password. */
export async function PATCH(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return apiError(
      "VALIDATION_ERROR",
      "Password must be at least 4 characters",
      400
    );
  }

  const venue = await resolveVenue({ req });
  if (!venue) return apiError("VENUE_NOT_FOUND", "Venue not found", 404);

  const denied = await requireStaffSession(req, venue.id);
  if (denied) return denied;

  try {
    await setVenueStaffPassword(venue.id, parsed.data.password);
    return Response.json({ ok: true });
  } catch (e) {
    console.error("[staff-password]", e);
    return apiError("SAVE_FAILED", "Could not save staff password", 500);
  }
}
