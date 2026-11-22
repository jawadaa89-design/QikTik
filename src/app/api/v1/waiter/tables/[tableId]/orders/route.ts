import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { waiterOrderSchema, apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { ensurePartySizeAlert, missingPartySize } from "@/lib/party-size";
import { requireFeature } from "@/lib/features";
import { requireStaffSession, verifyAdminPassword } from "@/lib/staff-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const { tableId } = await params;
  const body = await req.json();
  const parsed = waiterOrderSchema.safeParse(body);
  if (!parsed.success) {
    return apiError("VALIDATION_ERROR", parsed.error.message, 400);
  }

  const table = await prisma.table.findUnique({
    where: { id: tableId },
  });
  if (!table) return apiError("TABLE_NOT_FOUND", "Table not found", 404);

  const blocked = await requireFeature("ordering", table.venueId);
  if (blocked) return blocked;
  if (table.status === "DISABLED") {
    return apiError("TABLE_DISABLED", "Table is disabled", 400);
  }

  let session = await prisma.session.findFirst({
    where: { tableId, status: { in: ["OPEN", "BILL_REQUESTED"] } },
    orderBy: { openedAt: "desc" },
  });

  const pickupName = parsed.data.guestName?.trim() || null;

  if (!session) {
    session = await prisma.session.create({
      data: {
        tableId,
        venueId: table.venueId,
        locale: parsed.data.locale,
        status: "OPEN",
        guestName: pickupName ?? undefined,
      },
    });
  } else if (session.status === "BILL_REQUESTED") {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        status: "OPEN",
        ...(pickupName ? { guestName: pickupName } : {}),
      },
    });
    if (pickupName) session = { ...session, guestName: pickupName, status: "OPEN" };
    else session = { ...session, status: "OPEN" };
    await prisma.table.update({
      where: { id: tableId },
      data: { status: "ACTIVE" },
    });
    await prisma.waiterAlert.updateMany({
      where: { tableId, type: "BILL_REQUESTED", read: false },
      data: { read: true },
    });
  } else if (pickupName && pickupName !== session.guestName) {
    await prisma.session.update({
      where: { id: session.id },
      data: { guestName: pickupName },
    });
    session = { ...session, guestName: pickupName };
  }

  if (pickupName) {
    publish(RealtimeEvents.SESSION_UPDATED, {
      sessionId: session.id,
      tableId,
      guestName: pickupName,
    });
  }

  if (table.status === "FREE" || table.status === "BILL_REQUESTED") {
    await prisma.table.update({
      where: { id: tableId },
      data: { status: "ACTIVE" },
    });
  }

  if (missingPartySize(session.partySize)) {
    await ensurePartySizeAlert(tableId, session.id);
  }

  const menuItems = await prisma.menuItem.findMany({
    where: { id: { in: parsed.data.items.map((i) => i.menuItemId) } },
  });
  const priceMap = new Map(menuItems.map((m) => [m.id, m.price]));

  const priceOverride = parsed.data.items.some(
    (item) => item.free === true || item.unitPrice != null
  );

  if (priceOverride) {
    const ok = await verifyAdminPassword(
      parsed.data.adminPassword ?? "",
      table.venueId
    );
    if (!ok) {
      return apiError(
        "ADMIN_PASSWORD_REQUIRED",
        "Admin password required for free or custom-price items",
        401
      );
    }
  }

  type Resolved = {
    menuItemId: string;
    quantity: number;
    unitPrice: string;
    notes: string | null;
    takeaway: boolean;
  };

  const resolved: Resolved[] = [];
  let subtotal = 0;

  for (const item of parsed.data.items) {
    const menuPrice = priceMap.get(item.menuItemId);
    if (menuPrice == null) {
      return apiError("MENU_ITEM_NOT_FOUND", `Item ${item.menuItemId} not found`, 400);
    }

    let unit: number;
    const tags: string[] = [];
    if (item.free) {
      unit = 0;
      tags.push("FREE");
    } else if (item.unitPrice != null) {
      unit = parseFloat(item.unitPrice);
      if (Number.isNaN(unit) || unit < 0) {
        return apiError("VALIDATION_ERROR", "Invalid custom unit price", 400);
      }
      if (Math.abs(unit - Number(menuPrice)) > 0.001) {
        tags.push(`PRICE ${Number(menuPrice).toFixed(2)}→${unit.toFixed(2)}`);
      }
    } else {
      unit = Number(menuPrice);
    }

    const notes =
      [item.notes?.trim(), tags.length ? `[${tags.join(" · ")}]` : null]
        .filter(Boolean)
        .join(" ") || null;

    subtotal += unit * item.quantity;
    resolved.push({
      menuItemId: item.menuItemId,
      quantity: item.quantity,
      unitPrice: unit.toFixed(2),
      notes,
      takeaway: Boolean(item.takeaway),
    });
  }

  const orderCount = await prisma.order.count({ where: { sessionId: session.id } });

  const order = await prisma.order.create({
    data: {
      sessionId: session.id,
      orderNumber: orderCount + 1,
      paymentMode: "ADD_TO_TAB",
      status: "SENT_TO_KITCHEN",
      subtotal: subtotal.toFixed(2),
      submittedAt: new Date(),
      notes: "Waiter manual order",
      items: {
        create: resolved.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
          takeaway: item.takeaway,
          status: "RECEIVED",
        })),
      },
    },
    include: { items: true },
  });

  publish(RealtimeEvents.ORDER_NEW, {
    orderId: order.id,
    tableNumber: table.number,
    section: table.section,
    source: "waiter",
  });

  return Response.json(
    {
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        subtotal: order.subtotal.toString(),
        status: order.status,
      },
      sessionId: session.id,
    },
    { status: 201 }
  );
}
