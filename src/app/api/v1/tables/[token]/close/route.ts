import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { partySizeRequiredResponse } from "@/lib/party-size";

/**
 * Guest ends the visit when nothing is owed (no unpaid tab).
 * Rejects if there is still a balance to pay.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const table = await prisma.table.findUnique({
    where: { token },
    include: {
      sessions: {
        where: { status: { in: ["OPEN", "BILL_REQUESTED"] } },
        orderBy: { openedAt: "desc" },
        take: 1,
        include: {
          orders: { include: { payment: true } },
          payments: true,
        },
      },
    },
  });

  if (!table) return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);
  const session = table.sessions[0];
  if (!session) return apiError("NO_SESSION", "No open session", 400);

  const blocked = partySizeRequiredResponse(session.partySize);
  if (blocked) return blocked;

  const tabBalance = session.orders
    .filter(
      (o) =>
        o.paymentMode === "ADD_TO_TAB" &&
        o.status !== "CANCELLED" &&
        !o.payment
    )
    .reduce((sum, o) => sum + Number(o.subtotal), 0);

  const paidTotal = session.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const unpaid = Math.max(0, tabBalance - paidTotal);
  if (unpaid > 0) {
    return apiError(
      "BALANCE_DUE",
      "Cannot leave while the table still has unpaid charges",
      400
    );
  }

  await prisma.session.update({
    where: { id: session.id },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await prisma.table.update({
    where: { id: table.id },
    data: { status: "FREE" },
  });
  await prisma.waiterAlert.updateMany({
    where: { tableId: table.id, read: false },
    data: { read: true },
  });

  publish(RealtimeEvents.SESSION_UPDATED, {
    sessionId: session.id,
    tableId: table.id,
    status: "CLOSED",
  });

  return Response.json({ closed: true });
}
