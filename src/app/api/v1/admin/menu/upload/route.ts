import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";
import { resolveVenue } from "@/lib/venue";
import {
  assertVenueImageFile,
  storeMenuItemImage,
} from "@/lib/venue-image-storage";

export const dynamic = "force-dynamic";

/** Upload a menu item image → Vercel Blob (prod) or public/uploads/menu/{venueId}/ (local). */
export async function POST(req: NextRequest) {
  const denied = await requireStaffSession(req);
  if (denied) return denied;

  const form = await req.formData().catch(() => null);
  if (!form) return apiError("VALIDATION_ERROR", "Expected multipart form", 400);

  const itemId = String(form.get("itemId") ?? "").trim();
  const file = form.get("file");

  if (!itemId) return apiError("VALIDATION_ERROR", "itemId required", 400);
  if (!(file instanceof File)) {
    return apiError("VALIDATION_ERROR", "file required", 400);
  }

  const fileError = assertVenueImageFile(file);
  if (fileError) return apiError("VALIDATION_ERROR", fileError, 400);

  const venue = await resolveVenue({ req });
  if (!venue) return apiError("VENUE_NOT_FOUND", "Venue not found", 404);

  const item = await prisma.menuItem.findUnique({
    where: { id: itemId },
    include: { category: { select: { venueId: true } } },
  });
  if (!item) return apiError("NOT_FOUND", "Menu item not found", 404);
  if (item.category.venueId !== venue.id) {
    return apiError("FORBIDDEN", "Item does not belong to this venue", 403);
  }

  try {
    const imageUrl = await storeMenuItemImage(venue.id, item.id, file);
    await prisma.menuItem.update({
      where: { id: item.id },
      data: { imageUrl },
    });

    return Response.json({
      ok: true,
      imageUrl,
      storage: process.env.BLOB_READ_WRITE_TOKEN?.trim() ? "blob" : "local",
    });
  } catch (e) {
    console.error("[menu-upload]", e);
    return apiError("UPLOAD_FAILED", "Could not store image", 500);
  }
}
