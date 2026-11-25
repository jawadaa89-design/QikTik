import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { cardPaymentSchema, apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { createPaymentIntent, isStripeConfigured } from "@/lib/stripe";
import { partySizeRequiredResponse } from "@/lib/party-size";
import { requireStaffSession } from "@/lib/staff-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
    const { tableId } = await params;
  const body = await req.json();
  const parsed = cardPaymentSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      venue: true,
      sessions: {
        where: { status: { in: ["OPEN", "BILL_REQUESTED"] } },
        orderBy: { openedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!table) return apiError("TABLE_NOT_FOUND", "Table not found", 404);
  const denied = await requireStaffSession(req, table.venueId);
  if (denied) return denied;
  const session = table.sessions[0];
  if (!session) return apiError("NO_SESSION", "No open session", 400);

  if (parsed.data.closeSession) {
    const blocked = partySizeRequiredResponse(session.partySize);
    if (blocked) return blocked;
  }

  const amount = parseFloat(parsed.data.amount);
  const tip = Math.max(0, parseFloat(parsed.data.tipAmount || "0") || 0);
  if (Number.isNaN(amount) || amount <= 0) {
    return apiError("INVALID_AMOUNT", "Invalid amount", 400);
  }

  const chargeTotal = amount + tip;

  const pi = await createPaymentIntent({
    amountIls: chargeTotal,
    orderId: `waiter-${session.id}`,
    sessionId: session.id,
    currency: table.venue.currency,
  });

  // Waiter terminal flow: mark completed in demo, or when Stripe not used as online Elements
  const completed = pi.demo || !isStripeConfigured();

  const payment = await prisma.payment.create({
    data: {
      sessionId: session.id,
      amount: amount.toFixed(2),
      tipAmount: tip > 0 ? tip.toFixed(2) : null,
      method: "CARD",
      status: completed ? "COMPLETED" : "PENDING",
      stripePaymentId: pi.paymentIntentId,
      paidAt: completed ? new Date() : null,
    },
  });

  if (parsed.data.closeSession && completed) {
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
    method: "CARD",
  });

  return Response.json({
    paymentId: payment.id,
    status: payment.status,
    tipAmount: tip.toFixed(2),
    total: chargeTotal.toFixed(2),
    demo: pi.demo,
    reference: parsed.data.reference ?? null,
    clientSecret: completed ? null : pi.clientSecret,
    closed: Boolean(parsed.data.closeSession && completed),
  });
}
