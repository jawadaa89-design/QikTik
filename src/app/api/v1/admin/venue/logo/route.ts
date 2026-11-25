import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";
import { resolveVenue } from "@/lib/venue";
import {
  assertLogoFile,
  storeVenueLogo,
} from "@/lib/venue-logo-storage";

export const dynamic = "force-dynamic";

/** POST /api/v1/admin/venue/logo — upload restaurant logo (Blob or local). */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return apiError("VALIDATION_ERROR", "Expected multipart form", 400);

  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError("VALIDATION_ERROR", "file required", 400);
  }

  const fileError = assertLogoFile(file);
  if (fileError) return apiError("VALIDATION_ERROR", fileError, 400);

  const venueIdRaw = String(form.get("venueId") ?? "").trim();
  const venue = venueIdRaw
    ? await prisma.venue.findUnique({ where: { id: venueIdRaw } })
    : await resolveVenue({ req });

  if (!venue) return apiError("VENUE_NOT_FOUND", "Venue not found", 404);

  const denied = await requireStaffSession(req, venue.id);
  if (denied) return denied;

  try {
    const logoUrl = await storeVenueLogo(venue.id, file);
    const updated = await prisma.venue.update({
      where: { id: venue.id },
      data: { logoUrl },
    });
    return Response.json({
      ok: true,
      logoUrl: updated.logoUrl,
      storage: process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "blob" : "local",
    });
  } catch (e) {
    console.error("[venue-logo]", e);
    return apiError("UPLOAD_FAILED", "Could not store logo", 500);
  }
}
