import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireFeature } from "@/lib/features";
import { requireStaffVenue } from "@/lib/staff-auth";

export const dynamic = "force-dynamic";

function serializeAssistance(call: {
  id: string;
  venueId: string;
  customerName: string;
  orderRef: string;
  comment: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: call.id,
    venueId: call.venueId,
    customerName: call.customerName,
    orderRef: call.orderRef,
    comment: call.comment,
    status: call.status,
    createdAt: call.createdAt.toISOString(),
    updatedAt: call.updatedAt.toISOString(),
  };
}

/**
 * GET /api/v1/pickup/assistance?venue=&status=OPEN,ACKNOWLEDGED — staff waiter-call queue.
 */
export async function GET(req: NextRequest) {
  const statusParam = req.nextUrl.searchParams.get("status");

  const resolved = await requireStaffVenue(req);
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const blocked = await requireFeature("pickup", venue.id);
  if (blocked) return blocked;

  const allowed = new Set(["OPEN", "ACKNOWLEDGED", "DONE"]);
  const statuses = statusParam
    ? statusParam
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => allowed.has(s))
    : ["OPEN", "ACKNOWLEDGED"];

  if (statuses.length === 0) {
    return apiError("VALIDATION_ERROR", "No valid status filters", 400);
  }

  const calls = await prisma.pickupAssistanceCall.findMany({
    where: {
      venueId: venue.id,
      status: { in: statuses as ("OPEN" | "ACKNOWLEDGED" | "DONE")[] },
    },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });

  return Response.json({
    venue: { id: venue.id, name: venue.name, slug: venue.slug },
    calls: calls.map(serializeAssistance),
  });
}
