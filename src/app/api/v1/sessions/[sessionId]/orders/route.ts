import { NextRequest } from "next/server";
import { createOrderSchema, apiError } from "@/lib/validation";
import { prisma } from "@/lib/db";
import { createPaymentIntent } from "@/lib/stripe";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { requireFeature } from "@/lib/features";

type ExtraSnap = { id: string; name: string; price: string };

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;
  const body = await req.json();
  const parsed = createOrderSchema.safeParse(body);

  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { table: true, venue: true },
  });

  if (!session || session.status !== "OPEN") {
    return apiError("SESSION_NOT_FOUND", "Session not found or closed", 404);
  }

  const blocked = await requireFeature("ordering", session.venueId);
  if (blocked) return blocked;

  const { paymentMode, items } = parsed.data;
  const locale = session.locale || "ar";

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: items.map((i) => i.menuItemId) } },
    include: {
      translations: true,
      additionals: {
        where: { active: true },
        include: { translations: true },
      },
    },
  });

  const itemMap = new Map(menuItems.map((m) => [m.id, m]));

  const resolved: {
    menuItemId: string;
    quantity: number;
    notes: string | null;
    takeaway: boolean;
    unitPrice: string;
    extras: ExtraSnap[] | null;
  }[] = [];

  let subtotal = 0;
  for (const item of items) {
    const menuItem = itemMap.get(item.menuItemId);
    if (!menuItem) {
      return apiError("MENU_ITEM_NOT_FOUND", `Item ${item.menuItemId} not found`, 400);
    }
    if (!menuItem.available) {
      return apiError("MENU_ITEM_UNAVAILABLE", "One or more items are not available", 400);
    }

    const requestedIds = [...new Set(item.additionalIds ?? [])];
    const extras: ExtraSnap[] = [];
    for (const id of requestedIds) {
      const add = menuItem.additionals.find((a) => a.id === id);
      if (!add) {
        return apiError("VALIDATION_ERROR", `Unknown additional ${id}`, 400);
      }
      const name =
        add.translations.find((t) => t.locale === locale)?.name ??
        add.translations.find((t) => t.locale === "en")?.name ??
        add.translations[0]?.name ??
        "Extra";
      extras.push({ id: add.id, name, price: add.price.toString() });
    }

    const extrasTotal = extras.reduce((s, e) => s + Number(e.price), 0);
    const unit = Number(menuItem.price) + extrasTotal;
    subtotal += unit * item.quantity;

    const extrasNote =
      extras.length > 0 ? extras.map((e) => `+ ${e.name}`).join(", ") : "";
    const notes = [item.notes?.trim(), extrasNote].filter(Boolean).join(" · ") || null;

    resolved.push({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      notes,
      takeaway: Boolean(item.takeaway),
      unitPrice: unit.toFixed(2),
      extras: extras.length > 0 ? extras : null,
    });
  }

  const edgeOffline =
    process.env.DEPLOYMENT_MODE === "edge" && process.env.EDGE_ONLINE !== "true";
  if (paymentMode === "PAY_NOW" && edgeOffline) {
    return apiError(
      "PAYMENT_OFFLINE",
      "Card payments unavailable offline. Pay cash to your waiter.",
      402
    );
  }

  const orderCount = await prisma.order.count({ where: { sessionId } });

  const order = await prisma.order.create({
    data: {
      sessionId,
      orderNumber: orderCount + 1,
      paymentMode,
      status: "SENT_TO_KITCHEN",
      subtotal: subtotal.toFixed(2),
      submittedAt: new Date(),
      items: {
        create: resolved.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
          takeaway: item.takeaway,
          extras: item.extras ?? undefined,
          status: "RECEIVED",
        })),
      },
    },
    include: { items: true },
  });

  if (session.table.status === "FREE") {
    await prisma.table.update({
      where: { id: session.tableId },
      data: { status: "ACTIVE" },
    });
  }

  let paymentClientSecret: string | null = null;
  if (paymentMode === "PAY_NOW") {
    const pi = await createPaymentIntent({
      amountIls: subtotal,
      orderId: order.id,
      sessionId,
      currency: session.venue.currency,
    });
    paymentClientSecret = pi.clientSecret;

    await prisma.payment.create({
      data: {
        sessionId,
        orderId: order.id,
        amount: subtotal.toFixed(2),
        method: "CARD",
        status: pi.demo ? "COMPLETED" : "PENDING",
        stripePaymentId: pi.paymentIntentId,
        paidAt: pi.demo ? new Date() : null,
      },
    });
  }

  publish(RealtimeEvents.ORDER_NEW, {
    orderId: order.id,
    tableNumber: session.table.number,
    section: session.table.section,
    items: order.items.map((oi) => ({
      id: oi.id,
      route: itemMap.get(oi.menuItemId)?.route,
    })),
  });

  return Response.json(
    {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal.toString(),
        status: order.status,
      },
      paymentClientSecret,
    },
    { status: 201 }
  );
}
