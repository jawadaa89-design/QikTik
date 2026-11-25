import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";

/** Past closed sessions (old bills) for a table. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
    const { tableId } = await params;
  const locale = req.nextUrl.searchParams.get("locale") ?? "ar";
  const limit = Math.min(
    50,
    Math.max(1, Number(req.nextUrl.searchParams.get("limit") ?? "20") || 20)
  );

  const table = await prisma.table.findUnique({ where: { id: tableId } });
  if (!table) return apiError("TABLE_NOT_FOUND", "Table not found", 404);
  const denied = await requireStaffSession(req, table.venueId);
  if (denied) return denied;

  const sessions = await prisma.session.findMany({
    where: { tableId, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: limit,
    include: {
      orders: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { orderNumber: "asc" },
        include: {
          items: {
            include: { menuItem: { include: { translations: true } } },
          },
          payment: true,
        },
      },
      payments: {
        where: { status: "COMPLETED" },
        orderBy: { paidAt: "desc" },
      },
    },
  });

  const bills = sessions.map((session) => {
    let orderTotal = 0;
    let paidTotal = 0;
    let tipTotal = 0;

    for (const order of session.orders) {
      orderTotal += Number(order.subtotal);
    }
    for (const p of session.payments) {
      paidTotal += Number(p.amount);
      if (p.tipAmount != null) tipTotal += Number(p.tipAmount);
    }

    return {
      id: session.id,
      guestName: session.guestName,
      guestPhone: session.guestPhone,
      partySize: session.partySize,
      openedAt: session.openedAt.toISOString(),
      closedAt: (session.closedAt ?? session.updatedAt).toISOString(),
      orderTotal: orderTotal.toFixed(2),
      paidTotal: paidTotal.toFixed(2),
      tipTotal: tipTotal.toFixed(2),
      payments: session.payments.map((p) => ({
        id: p.id,
        method: p.method,
        amount: p.amount.toString(),
        tipAmount: p.tipAmount != null ? p.tipAmount.toString() : null,
        paidAt: (p.paidAt ?? p.createdAt).toISOString(),
      })),
      orders: session.orders.map((order) => ({
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        paymentMode: order.paymentMode,
        subtotal: order.subtotal.toString(),
        items: order.items.map((item) => ({
          id: item.id,
          name:
            item.menuItem.translations.find((t) => t.locale === locale)?.name ??
            item.menuItem.translations[0]?.name ??
            "Item",
          quantity: item.quantity,
          unitPrice: item.unitPrice.toString(),
          notes: item.notes,
        })),
      })),
    };
  });

  return Response.json({
    table: { id: table.id, number: table.number, section: table.section },
    bills,
  });
}
