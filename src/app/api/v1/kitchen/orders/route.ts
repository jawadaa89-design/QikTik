import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import type { StationRoute } from "@prisma/client";
import { requireStaffVenue } from "@/lib/staff-auth";

const ACTIVE_ITEM = ["RECEIVED", "PREPARING", "READY"] as const;

export async function GET(req: NextRequest) {
  const resolved = await requireStaffVenue(req);
  if ("error" in resolved) return resolved.error;
  const { venue } = resolved;

  const station = req.nextUrl.searchParams.get("station") as StationRoute | null;
  const locale = req.nextUrl.searchParams.get("locale") ?? "ar";

  const items = await prisma.orderItem.findMany({
    where: {
      status: { in: [...ACTIVE_ITEM] },
      ...(station ? { menuItem: { route: station } } : {}),
      order: {
        status: { in: ["SENT_TO_KITCHEN", "IN_PROGRESS"] },
        session: { venueId: venue.id },
      },
    },
    include: {
      menuItem: { include: { translations: true } },
      order: {
        include: {
          session: { include: { table: true } },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Group by order
  const byOrder = new Map<
    string,
    {
      id: string;
      tableNumber: number;
      section: string;
      orderNumber: number;
      ageMinutes: number;
      status: string;
      items: {
        id: string;
        menuItemId: string;
        name: string;
        quantity: number;
        notes: string | null;
        takeaway: boolean;
        route: string;
        status: string;
      }[];
    }
  >();

  const now = Date.now();

  for (const item of items) {
    const order = item.order;
    let entry = byOrder.get(order.id);
    if (!entry) {
      const submitted = order.submittedAt ?? order.createdAt;
      entry = {
        id: order.id,
        tableNumber: order.session.table.number,
        section: order.session.table.section,
        orderNumber: order.orderNumber,
        ageMinutes: Math.floor((now - submitted.getTime()) / 60_000),
        status: order.status,
        items: [],
      };
      byOrder.set(order.id, entry);
    }

    const name =
      item.menuItem.translations.find((t) => t.locale === locale)?.name ??
      item.menuItem.translations.find((t) => t.locale === "en")?.name ??
      item.menuItem.translations[0]?.name ??
      "Item";

    entry.items.push({
      id: item.id,
      menuItemId: item.menuItemId,
      name,
      quantity: item.quantity,
      notes: item.notes,
      takeaway: Boolean(item.takeaway),
      route: item.menuItem.route,
      status: item.status,
    });
  }

  return Response.json({ orders: [...byOrder.values()], station: station ?? "ALL" });
}
