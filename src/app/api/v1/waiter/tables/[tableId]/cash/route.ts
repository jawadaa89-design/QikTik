import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cashPaymentSchema, apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { partySizeRequiredResponse } from "@/lib/party-size";
import { requireStaffSession } from "@/lib/staff-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const { tableId } = await params;
  const body = await req.json();
  const parsed = cashPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      sessions: {
        where: { status: { in: ["OPEN", "BILL_REQUESTED"] } },
        orderBy: { openedAt: "desc" },
        take: 1,
        include: { orders: { include: { payment: true } } },
      },
    },
  });

  if (!table) return apiError("TABLE_NOT_FOUND", "Table not found", 404);
  const session = table.sessions[0];
  if (!session) return apiError("NO_SESSION", "No open session", 400);

  if (parsed.data.closeSession) {
    const blocked = partySizeRequiredResponse(session.partySize);
    if (blocked) return blocked;
  }

  const amount = parseFloat(parsed.data.amount);
  const tip = Math.max(0, parseFloat(parsed.data.tipAmount || "0") || 0);
  const received = parseFloat(parsed.data.received);
  if (Number.isNaN(amount) || amount <= 0) {
    return apiError("INVALID_AMOUNT", "Invalid amount", 400);
  }
  const due = amount + tip;
  if (received < due) {
    return apiError("INSUFFICIENT", "Received less than amount due (including tip)", 400);
  }

  const payment = await prisma.payment.create({
    data: {
      sessionId: session.id,
      amount: amount.toFixed(2),
      tipAmount: tip > 0 ? tip.toFixed(2) : null,
      method: "CASH",
      status: "COMPLETED",
      paidAt: new Date(),
    },
  });

  if (parsed.data.closeSession) {
    await prisma.session.update({
      where: { id: session.id },
      data: { status: "CLOSED", closedAt: new Date() },
    });
    await prisma.table.update({
      where: { id: tableId },
      data: { status: "FREE" },
    });
    await prisma.waiterAlert.updateMany({
      where: { tableId, read: false },
      data: { read: true },
    });
  }

  publish(RealtimeEvents.PAYMENT_COMPLETED, {
    sessionId: session.id,
    tableId,
    paymentId: payment.id,
  });

  return Response.json({
    paymentId: payment.id,
    tipAmount: tip.toFixed(2),
    change: (received - due).toFixed(2),
    closed: parsed.data.closeSession,
  });
}
