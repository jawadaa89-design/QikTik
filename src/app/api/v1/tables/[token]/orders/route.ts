import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";

/** Current visit orders only — paid/closed sessions are not shown again. */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const localeParam = req.nextUrl.searchParams.get("locale");

  const table = await prisma.table.findUnique({
    where: { token },
    include: { venue: true },
  });

  if (!table) {
    return apiError("TABLE_NOT_FOUND", "Invalid table token", 404);
  }

  const openSession = await prisma.session.findFirst({
    where: {
      tableId: table.id,
      status: { in: ["OPEN", "BILL_REQUESTED"] },
    },
    orderBy: { openedAt: "desc" },
    include: {
      payments: true,
      orders: {
        where: { status: { not: "CANCELLED" } },
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              menuItem: { include: { translations: true } },
            },
          },
        },
      },
    },
  });

  const locale =
    localeParam || openSession?.locale || table.venue.defaultLocale || "ar";

  const currentOrders =
    openSession?.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      subtotal: order.subtotal.toString(),
      status: order.status,
      paymentMode: order.paymentMode,
      submittedAt: (order.submittedAt ?? order.createdAt).toISOString(),
      items: order.items.map((item) => ({
        id: item.id,
        name:
          item.menuItem.translations.find((t) => t.locale === locale)?.name ??
          item.menuItem.translations.find((t) => t.locale === "en")?.name ??
          item.menuItem.translations[0]?.name ??
          "Item",
        status: item.status,
        quantity: item.quantity,
        notes: item.notes,
        takeaway: item.takeaway,
      })),
    })) ?? [];

  let tabBalance = 0;
  let paidTotal = 0;
  if (openSession) {
    for (const order of openSession.orders) {
      if (order.paymentMode === "ADD_TO_TAB") {
        tabBalance += Number(order.subtotal);
      }
    }
    paidTotal = openSession.payments
      .filter((p) => p.status === "COMPLETED")
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }

  return Response.json({
    table: {
      id: table.id,
      number: table.number,
      section: table.section,
    },
    sessionId: openSession?.id ?? null,
    sessionStatus: openSession?.status ?? null,
    guestName: openSession?.guestName ?? null,
    tabBalance: Math.max(0, tabBalance - paidTotal).toFixed(2),
    paidTotal: paidTotal.toFixed(2),
    orders: currentOrders,
    history: [],
  });
}
