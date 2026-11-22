import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { requireStaffSession } from "@/lib/staff-auth";
import { apiError, pickupStatusUpdateSchema } from "@/lib/validation";
import { requireFeature } from "@/lib/features";
import { sendPickupWebPush } from "@/lib/web-push";

export const dynamic = "force-dynamic";

function serializeTicket(ticket: {
  id: string;
  venueId: string;
  customerName: string;
  phone: string | null;
  orderRef: string | null;
  status: string;
  readyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: ticket.id,
    venueId: ticket.venueId,
    customerName: ticket.customerName,
    phone: ticket.phone,
    orderRef: ticket.orderRef,
    status: ticket.status,
    readyAt: ticket.readyAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

/** GET /api/v1/pickup/:id — guest waiting page / status poll */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ticket = await prisma.pickupTicket.findUnique({ where: { id } });
  if (!ticket) return apiError("NOT_FOUND", "Pickup ticket not found", 404);
  const blocked = await requireFeature("pickup", ticket.venueId);
  if (blocked) return blocked;
  return Response.json({
    ticket: serializeTicket(ticket),
    // Guest waiting UI: distinguish DB-backed Web Push vs foreground-only Notification.
    hasPushSubscription: Boolean(ticket.pushSubscription?.trim()),
  });
}

/** PATCH /api/v1/pickup/:id — staff mark READY / COMPLETED / CANCELLED */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError("INVALID_JSON", "Invalid JSON body", 400);
  }

  const parsed = pickupStatusUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const existing = await prisma.pickupTicket.findUnique({ where: { id } });
  if (!existing) return apiError("NOT_FOUND", "Pickup ticket not found", 404);

  const blocked = await requireFeature("pickup", existing.venueId);
  if (blocked) return blocked;

  const status = parsed.data.status;
  const ticket = await prisma.pickupTicket.update({
    where: { id },
    data: {
      status,
      readyAt:
        status === "READY"
          ? existing.readyAt ?? new Date()
          : status === "WAITING"
            ? null
            : existing.readyAt,
    },
  });

  const payload = serializeTicket(ticket);
  publish(RealtimeEvents.PICKUP_UPDATED, payload);

  // Web Push when staff marks READY (in addition to SSE / in-page Notification).
  let push:
    | { sent: boolean; reason?: string; tag?: string; endpointHost?: string }
    | undefined;
  if (status === "READY" && existing.status !== "READY") {
    push = await sendPickupWebPush({
      ticketId: ticket.id,
      customerName: ticket.customerName,
      kind: "ready",
    });
    console.info(
      `[pickup-ready] ticket=${ticket.id}`,
      `push.sent=${push.sent}`,
      `reason=${push.reason ?? "ok"}`,
      `tag=${push.tag ?? "-"}`,
      `host=${push.endpointHost ?? "-"}`
    );
  }

  return Response.json({ ticket: payload, push });
}
