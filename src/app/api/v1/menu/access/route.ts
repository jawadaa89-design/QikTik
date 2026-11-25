import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { utcDay } from "@/lib/menu-access";
import { apiError } from "@/lib/validation";
import { requireVenue } from "@/lib/venue";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  visitorId: z.string().trim().min(8).max(80),
  venueSlug: z.string().trim().min(1).max(64).optional(),
});

/**
 * POST /api/v1/menu/access — record one unique guest menu visit for today.
 * Idempotent per (venue, visitor, day).
 */
export async function POST(req: NextRequest) {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON", 400);
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", "visitorId required", 400);
  }

  const resolved = await requireVenue(req, { slug: parsed.data.venueSlug });
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const day = utcDay();
  const visitorId = parsed.data.visitorId.slice(0, 80);

  try {
    await prisma.menuAccessDay.upsert({
      where: {
        venueId_visitorId_day: {
          venueId: venue.id,
          visitorId,
          day,
        },
      },
      create: {
        venueId: venue.id,
        visitorId,
        day,
      },
      update: {},
    });
  } catch (e) {
    console.error("[menu-access]", e);
    return apiError("SAVE_FAILED", "Could not record menu access", 500);
  }

  return Response.json({ ok: true });
}
