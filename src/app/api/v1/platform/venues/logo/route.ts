import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import {
  assertLogoFile,
  storeVenueLogo,
} from "@/lib/venue-logo-storage";
import { platformPasswordOk } from "@/lib/platform-auth";

export const dynamic = "force-dynamic";

/** POST /api/v1/platform/venues/logo — platform password + venueId + file. */
export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  if (!form) return apiError("VALIDATION_ERROR", "Expected multipart form", 400);

  const password = String(form.get("password") ?? "");
  if (!platformPasswordOk(password)) {
    return apiError("UNAUTHORIZED", "Wrong platform password", 401);
  }

  const venueId = String(form.get("venueId") ?? "").trim();
  if (!venueId) return apiError("VALIDATION_ERROR", "venueId required", 400);

  const file = form.get("file");
  if (!(file instanceof File)) {
    return apiError("VALIDATION_ERROR", "file required", 400);
  }
  const fileError = assertLogoFile(file);
  if (fileError) return apiError("VALIDATION_ERROR", fileError, 400);

  const venue = await prisma.venue.findUnique({ where: { id: venueId } });
  if (!venue) return apiError("VENUE_NOT_FOUND", "Venue not found", 404);

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
    console.error("[platform-venue-logo]", e);
    return apiError("UPLOAD_FAILED", "Could not store logo", 500);
  }
}
