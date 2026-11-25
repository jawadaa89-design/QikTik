import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { updateItemStatusSchema, apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { suppressPartySizeAlert } from "@/lib/party-size";
import { requireStaffSession } from "@/lib/staff-auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ orderId: string; itemId: string }> }
) {
  const { orderId, itemId } = await params;
  const body = await req.json();
  const parsed = updateItemStatusSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const item = await prisma.orderItem.findFirst({
    where: { id: itemId, orderId },
    include: {
      order: { include: { session: { include: { table: true } } } },
      menuItem: true,
    },
  });

  if (!item) {
    return apiError("ITEM_NOT_FOUND", "Order item not found", 404);
  }

  const denied = await requireStaffSession(req, item.order.session.venueId);
  if (denied) return denied;

  const updated = await prisma.orderItem.update({
    where: { id: itemId },
    data: { status: parsed.data.status },
  });

  // Roll up order status
  const siblings = await prisma.orderItem.findMany({ where: { orderId } });
  let orderStatus: "SENT_TO_KITCHEN" | "IN_PROGRESS" | "COMPLETE" = "SENT_TO_KITCHEN";
  const active = siblings.filter((s) => s.status !== "CANCELLED");
  if (active.every((s) => s.status === "SERVED" || s.status === "READY")) {
    // READY means kitchen done; SERVED means waiter took it
    if (active.every((s) => s.status === "SERVED")) {
      orderStatus = "COMPLETE";
    } else {
      orderStatus = "IN_PROGRESS";
    }
  } else if (active.some((s) => s.status === "PREPARING" || s.status === "READY" || s.status === "SERVED")) {
    orderStatus = "IN_PROGRESS";
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: orderStatus },
  });

  const tableNumber = item.order.session.table.number;
  const guestName = item.order.session.guestName ?? null;
  const tableId = item.order.session.tableId;

  // Alert waiter when item becomes READY (overrides guest-count reminder)
  if (parsed.data.status === "READY") {
    await suppressPartySizeAlert(tableId);
    const who = guestName ? ` — ${guestName}` : "";
    await prisma.waiterAlert.create({
      data: {
        tableId,
        sessionId: item.order.sessionId,
        type: "ORDER_READY",
        message: `Table ${tableNumber}${who} — ready to pick up`,
      },
    });
    publish(RealtimeEvents.ALERT_NEW, { tableId, guestName, tableNumber });
  }

  publish(RealtimeEvents.ORDER_ITEM_STATUS, {
    orderId,
    itemId,
    status: updated.status,
    sessionId: item.order.sessionId,
    tableId,
    tableNumber,
    guestName,
  });

  return Response.json({
    orderItemId: updated.id,
    status: updated.status,
    orderStatus,
    updatedAt: updated.updatedAt.toISOString(),
  });
}
