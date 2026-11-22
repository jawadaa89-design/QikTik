import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      payments: true,
      orders: {
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

  if (!session) {
    return apiError("SESSION_NOT_FOUND", "Session not found", 404);
  }

  const tabBalance = session.orders
    .filter((o) => o.paymentMode === "ADD_TO_TAB" && o.status !== "CANCELLED")
    .reduce((sum, o) => sum + Number(o.subtotal), 0);

  const paidTotal = session.payments
    .filter((p) => p.status === "COMPLETED")
    .reduce((sum, p) => sum + Number(p.amount), 0);

  // unpaid tab = ADD_TO_TAB orders minus completed cash/card applied to session without orderId
  const unpaid = Math.max(0, tabBalance - paidTotal);

  return Response.json({
    sessionId: session.id,
    tabBalance: unpaid.toFixed(2),
    paidTotal: paidTotal.toFixed(2),
    status: session.status,
    orders: session.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      subtotal: order.subtotal.toString(),
      status: order.status,
      items: order.items.map((item) => ({
        id: item.id,
        name:
          item.menuItem.translations.find((t) => t.locale === session.locale)?.name ??
          item.menuItem.translations[0]?.name ??
          "Item",
        status: item.status,
        quantity: item.quantity,
      })),
    })),
  });
}
