import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requireStaffSession } from "@/lib/staff-auth";
import { getPublicBaseUrl } from "@/lib/public-url";
import { featuresFromFlags } from "@/lib/features";
import { resolveVenueFromRequest } from "@/lib/venue";

export async function GET(req: NextRequest) {
  const denied = await requireStaffSession();
  if (denied) return denied;

  const venue = await resolveVenueFromRequest(req);

  const locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "ar";
  const base = getPublicBaseUrl(req);

  if (!venue) {
    return Response.json({
      venue: null,
      features: {
        digitalMenu: true,
        alerts: true,
        ordering: true,
        pickup: false,
      },
      stats: {
        revenueToday: "0.00",
        ordersToday: 0,
        openTables: 0,
        avgCheck: "0.00",
        menuItems: 0,
        pickupWaiting: 0,
        pickupReady: 0,
      },
      recent: [],
      recentPickup: [],
      pickupGuestUrl: `${base}/${locale}/pickup`,
      menuGuestUrl: `${base}/${locale}/menu`,
      // Alerts-only → /alerts; with pickup → combined pickup board (calls + queues)
      alertsBoardUrl: `${base}/alerts/live`,
    });
  }

  const features = featuresFromFlags(
    venue.alertsEnabled,
    venue.orderingEnabled,
    venue.pickupEnabled
  );

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [
    ordersToday,
    openTables,
    paymentsToday,
    recentOrders,
    menuItems,
    pickupWaiting,
    pickupReady,
    recentPickup,
  ] = await Promise.all([
    features.ordering
      ? prisma.order.findMany({
          where: { createdAt: { gte: startOfDay }, status: { not: "CANCELLED" } },
        })
      : Promise.resolve([]),
    features.ordering
      ? prisma.table.count({
          where: { status: { in: ["ACTIVE", "BILL_REQUESTED"] } },
        })
      : Promise.resolve(0),
    features.ordering
      ? prisma.payment.findMany({
          where: { status: "COMPLETED", paidAt: { gte: startOfDay } },
        })
      : Promise.resolve([]),
    features.ordering
      ? prisma.order.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          include: {
            session: { include: { table: true } },
          },
        })
      : Promise.resolve([]),
    prisma.menuItem.count({
      where: {
        available: true,
        hidden: false,
        category: { venueId: venue.id },
      },
    }),
    features.pickup
      ? prisma.pickupTicket.count({
          where: { venueId: venue.id, status: "WAITING" },
        })
      : Promise.resolve(0),
    features.pickup
      ? prisma.pickupTicket.count({
          where: { venueId: venue.id, status: "READY" },
        })
      : Promise.resolve(0),
    features.pickup
      ? prisma.pickupTicket.findMany({
          where: { venueId: venue.id },
          take: 8,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            customerName: true,
            orderRef: true,
            status: true,
            createdAt: true,
          },
        })
      : Promise.resolve([]),
  ]);

  const revenue = paymentsToday.reduce((s, p) => s + Number(p.amount), 0);
  const orderRevenue = ordersToday.reduce((s, o) => s + Number(o.subtotal), 0);
  const displayRevenue = revenue > 0 ? revenue : orderRevenue;
  const avg =
    ordersToday.length > 0 ? displayRevenue / ordersToday.length : 0;

  return Response.json({
    venue: {
      id: venue.id,
      name: venue.name,
      currency: venue.currency,
      defaultLocale: venue.defaultLocale,
    },
    features,
    stats: {
      revenueToday: displayRevenue.toFixed(2),
      ordersToday: ordersToday.length,
      openTables,
      avgCheck: avg.toFixed(2),
      menuItems,
      pickupWaiting,
      pickupReady,
    },
    recent: recentOrders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      tableNumber: o.session.table.number,
      section: o.session.table.section,
      subtotal: o.subtotal.toString(),
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
    recentPickup: recentPickup.map((p) => ({
      id: p.id,
      customerName: p.customerName,
      orderRef: p.orderRef,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    })),
    pickupGuestUrl: `${base}/${locale}/pickup`,
    menuGuestUrl: `${base}/${locale}/menu`,
    alertsBoardUrl: features.pickup
      ? `${base}/pickup/live`
      : `${base}/alerts/live`,
  });
}
