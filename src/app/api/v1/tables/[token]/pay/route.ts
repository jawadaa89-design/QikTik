import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { guestPaySchema, apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { createPaymentIntent, isStripeConfigured } from "@/lib/stripe";
import { partySizeRequiredResponse } from "@/lib/party-size";

/** Guest pays remaining table tab by card (optional tip) and closes the visit. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const body = await req.json().catch(() => ({}));
  const parsed = guestPaySchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await prisma.table.findUnique({
    where: { token },
    include: {
      venue: true,
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

  const edgeOffline =
    process.env.DEPLOYMENT_MODE === "edge" && process.env.EDGE_ONLINE !== "true";
  if (edgeOffline) {
    return apiError(
      "PAYMENT_OFFLINE",
      "Card payments unavailable offline. Pay cash to your waiter.",
      402
    );
  }

  const tabBalance = session.orders
    .filter((o) => o.paymentMode === "ADD_TO_TAB" && o.status !== "CANCELLED" && !o.payment)
    .reduce((sum, o) => sum + Number(o.subtotal), 0);

  const paidTotal = session.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const unpaid = Math.max(0, tabBalance - paidTotal);
  if (unpaid <= 0) {
    return apiError("NOTHING_DUE", "Nothing left to pay", 400);
  }

  let tip = 0;
  if (parsed.data.tipAmount != null && parsed.data.tipAmount !== "") {
    tip = parseFloat(parsed.data.tipAmount);
  } else if (parsed.data.tipPct != null) {
    tip = (unpaid * parsed.data.tipPct) / 100;
  }
  if (Number.isNaN(tip) || tip < 0) tip = 0;
  tip = Math.round(tip * 100) / 100;

  const chargeTotal = unpaid + tip;

  const pi = await createPaymentIntent({
    amountIls: chargeTotal,
    orderId: `guest-tab-${session.id}`,
    sessionId: session.id,
    currency: table.venue.currency,
  });

  const completed = pi.demo || !isStripeConfigured();

  const payment = await prisma.payment.create({
    data: {
      sessionId: session.id,
      amount: unpaid.toFixed(2),
      tipAmount: tip > 0 ? tip.toFixed(2) : null,
      method: "CARD",
      status: completed ? "COMPLETED" : "PENDING",
      stripePaymentId: pi.paymentIntentId,
      paidAt: completed ? new Date() : null,
    },
  });

  if (completed) {
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
  }

  publish(RealtimeEvents.PAYMENT_COMPLETED, {
    sessionId: session.id,
    tableId: table.id,
    paymentId: payment.id,
    method: "CARD",
  });
  publish(RealtimeEvents.SESSION_UPDATED, {
    sessionId: session.id,
    tableId: table.id,
    status: completed ? "CLOSED" : session.status,
  });

  return Response.json({
    paymentId: payment.id,
    amount: unpaid.toFixed(2),
    tipAmount: tip.toFixed(2),
    total: chargeTotal.toFixed(2),
    status: payment.status,
    demo: pi.demo,
    clientSecret: completed ? null : pi.clientSecret,
    closed: completed,
  });
}
