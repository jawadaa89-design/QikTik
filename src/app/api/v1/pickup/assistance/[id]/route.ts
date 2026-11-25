import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { requireStaffSession } from "@/lib/staff-auth";
import { apiError, pickupAssistanceStatusUpdateSchema } from "@/lib/validation";
import { requireFeature } from "@/lib/features";

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
 * PATCH /api/v1/pickup/assistance/:id — staff acknowledge / done an assistance call.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = pickupAssistanceStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const existing = await prisma.pickupAssistanceCall.findUnique({ where: { id } });
  if (!existing) return apiError("NOT_FOUND", "Assistance call not found", 404);

  const denied = await requireStaffSession(req, existing.venueId);
  if (denied) return denied;

  const blocked = await requireFeature("pickup", existing.venueId);
  if (blocked) return blocked;

  const call = await prisma.pickupAssistanceCall.update({
    where: { id },
    data: { status: parsed.data.status },
  });

  const payload = serializeAssistance(call);
  publish(RealtimeEvents.PICKUP_ASSISTANCE_UPDATED, payload);

  if (parsed.data.status === "ACKNOWLEDGED") {
    try {
      const { notifyGuestAssistanceAcknowledged } = await import("@/lib/web-push");
      await notifyGuestAssistanceAcknowledged(call);
    } catch {
      /* ignore push failures */
    }
  }

  return Response.json({ call: payload });
}
