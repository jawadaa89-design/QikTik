import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { hasFeature } from "@/lib/features";
import { requireVenue } from "@/lib/venue";
import { apiError, resolveTableNumberSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

/**
 * POST /api/v1/tables/resolve
 * Guest enters a table number from the public menu → opaque token path for ordering.
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = resolveTableNumberSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("INVALID_INPUT", "Enter a valid table number", 400);
  }

  const venueResult = await requireVenue(req, { slug: parsed.data.venueSlug });
  if ("error" in venueResult) return venueResult.error;
  const { venue } = venueResult;

  if (!(await hasFeature("ordering", venue.id))) {
    return apiError(
      "FEATURE_DISABLED",
      "Table ordering is not enabled for this venue",
      403
    );
  }

  const table = await prisma.table.findUnique({
    where: {
      venueId_number: {
        venueId: venue.id,
        number: parsed.data.tableNumber,
      },
    },
    select: { token: true, number: true, status: true },
  });

  if (!table) {
    return apiError("TABLE_NOT_FOUND", "Table not found", 404);
  }
  if (table.status === "DISABLED") {
    return apiError("TABLE_DISABLED", "This table is not available", 403);
  }

  const locale = parsed.data.locale ?? process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "ar";
  const path = `/${locale}/t/${table.token}`;

  return Response.json({
    tableNumber: table.number,
    token: table.token,
    path,
  });
}
