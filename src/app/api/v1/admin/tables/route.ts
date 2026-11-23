import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { generateTableToken } from "@/lib/utils";
import { getPublicBaseUrl } from "@/lib/public-url";
import { z } from "zod";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";
import { requireVenue } from "@/lib/venue";
import { venueTablePath } from "@/lib/venue-paths";

export async function GET(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const resolved = await requireVenue(req);
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const tables = await prisma.table.findMany({
    where: { venueId: venue.id },
    orderBy: [{ section: "asc" }, { number: "asc" }],
    include: {
      sessions: {
        where: { status: { in: ["OPEN", "BILL_REQUESTED"] } },
        take: 1,
      },
    },
  });

  const base = getPublicBaseUrl(req);
  const locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "ar";

  return Response.json({
    tables: tables.map((t) => ({
      id: t.id,
      number: t.number,
      section: t.section,
      token: t.token,
      nfcTagId: t.nfcTagId,
      status: t.status,
      guestUrl: `${base}${venueTablePath(venue.slug, locale, t.token)}`,
      hasOpenSession: t.sessions.length > 0,
    })),
    baseUrl: base,
  });
}

const createTableSchema = z.object({
  number: z.number().int().positive(),
  section: z.enum(["INSIDE", "OUTSIDE", "TERRACE"]),
});

export async function POST(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const body = await req.json();
  const parsed = createTableSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const resolved = await requireVenue(req);
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const existing = await prisma.table.findFirst({
    where: { venueId: venue.id, number: parsed.data.number },
  });
  if (existing) return apiError("DUPLICATE", "Table number exists", 409);

  const table = await prisma.table.create({
    data: {
      venueId: venue.id,
      number: parsed.data.number,
      section: parsed.data.section,
      token: generateTableToken(),
      status: "FREE",
    },
  });

  return Response.json({ table }, { status: 201 });
}
