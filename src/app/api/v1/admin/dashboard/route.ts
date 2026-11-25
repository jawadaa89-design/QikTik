import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getPublicBaseUrl } from "@/lib/public-url";
import { featuresFromFlags } from "@/lib/features";
import { requireStaffVenue } from "@/lib/staff-auth";
import { venueMainPath, venueStaffPath } from "@/lib/venue-paths";

export async function GET(req: NextRequest) {
  const resolved = await requireStaffVenue(req);
  if ("error" in resolved) return resolved.error;
  const venue = resolved.venue;

  const locale = process.env.NEXT_PUBLIC_DEFAULT_LOCALE ?? "ar";
  const base = getPublicBaseUrl(req);

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
          where: {
            createdAt: { gte: startOfDay },
            status: { not: "CANCELLED" },
            session: { venueId: venue.id },
          },
        })
      : Promise.resolve([]),
    features.ordering
      ? prisma.table.count({
          where: {
            venueId: venue.id,
            status: { in: ["ACTIVE", "BILL_REQUESTED"] },
          },
        })
      : Promise.resolve(0),
    features.ordering
      ? prisma.payment.findMany({
          where: {
            status: "COMPLETED",
            paidAt: { gte: startOfDay },
            session: { venueId: venue.id },
          },
        })
      : Promise.resolve([]),
    features.ordering
      ? prisma.order.findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          where: { session: { venueId: venue.id } },
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
    menuGuestUrl: `${base}${venueMainPath(venue.slug, locale)}`,
    alertsBoardUrl: features.pickup
      ? `${base}${venueStaffPath(venue.slug, "pickup")}`
      : `${base}${venueStaffPath(venue.slug, "alerts")}`,
  });
}
