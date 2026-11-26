import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setVenueStaffPassword } from "@/lib/staff-auth";
import { verifyPlatformPassword } from "@/lib/platform-auth";
import { apiError } from "@/lib/validation";

export const dynamic = "force-dynamic";

const schema = z.object({
  password: z.string().min(1),
  venueId: z.string().trim().min(1).optional(),
  slug: z.string().trim().min(1).optional(),
  staffPassword: z.string().trim().min(4).max(72),
});

/**
 * PATCH /api/v1/platform/venues/staff-password
 * Reset a restaurant’s staff/admin unlock password (platform password required).
 */
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

  if (!(await verifyPlatformPassword(parsed.data.password))) {
    return apiError("UNAUTHORIZED", "Wrong platform password", 401);
  }

  const { venueId, slug, staffPassword } = parsed.data;
  if (!venueId && !slug) {
    return apiError("VALIDATION_ERROR", "venueId or slug required", 400);
  }

  const venue = venueId
    ? await prisma.venue.findUnique({ where: { id: venueId } })
    : await prisma.venue.findUnique({
        where: { slug: slug!.trim().toLowerCase() },
      });

  if (!venue) {
    return apiError("VENUE_NOT_FOUND", "Restaurant not found", 404);
  }

  try {
    await setVenueStaffPassword(venue.id, staffPassword);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Could not set password";
    return apiError("PASSWORD_ERROR", msg, 400);
  }

  return Response.json({
    ok: true,
    venue: { id: venue.id, name: venue.name, slug: venue.slug },
  });
}
