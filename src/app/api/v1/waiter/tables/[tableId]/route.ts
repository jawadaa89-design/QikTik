import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { requireStaffSession } from "@/lib/staff-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tableId: string }> }
) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const { tableId } = await params;
  const locale = req.nextUrl.searchParams.get("locale") ?? "ar";

  const table = await prisma.table.findUnique({
    where: { id: tableId },
    include: {
      sessions: {
        where: { status: { in: ["OPEN", "BILL_REQUESTED"] } },
        orderBy: { openedAt: "desc" },
        take: 1,
        include: {
          orders: {
            orderBy: { createdAt: "desc" },
            include: {
              items: {
                include: { menuItem: { include: { translations: true } } },
              },
              payment: true,
            },
          },
          payments: true,
        },
      },
    },
  });

  if (!table) return apiError("TABLE_NOT_FOUND", "Table not found", 404);

  const session = table.sessions[0] ?? null;
  let tabBalance = 0;
  let paidTotal = 0;

  if (session) {
    for (const p of session.payments) {
      if (p.status === "COMPLETED") paidTotal += Number(p.amount);
    }
    for (const order of session.orders) {
      if (order.paymentMode === "ADD_TO_TAB" && order.status !== "CANCELLED" && !order.payment) {
        tabBalance += Number(order.subtotal);
      }
    }
  }

  return Response.json({
    table: {
      id: table.id,
      number: table.number,
      section: table.section,
      status: table.status,
      token: table.token,
    },
    session: session
      ? {
          id: session.id,
          status: session.status,
          guestName: session.guestName,
          guestPhone: session.guestPhone,
          partySize: session.partySize,
          needsPartySize: session.partySize == null || session.partySize < 1,
          requestedTip:
            session.requestedTip != null ? Number(session.requestedTip).toFixed(2) : null,
          tipSpecified: session.requestedTip != null,
          tabBalance: tabBalance.toFixed(2),
          paidTotal: paidTotal.toFixed(2),
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
              status: item.status,
              notes: item.notes,
              takeaway: item.takeaway,
              route: item.menuItem.route,
            })),
          })),
        }
      : null,
  });
}
