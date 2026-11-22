import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";
import { suppressPartySizeAlert } from "@/lib/party-size";
import { requireStaffSession } from "@/lib/staff-auth";

const venueName = process.env.NEXT_PUBLIC_VENUE_NAME ?? "My Restaurant";

function money(n: number) {
  return `₪${n.toFixed(2)}`;
}

/** Build guest bill receipt and optionally send to edge printer. */
export async function POST(
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
      venue: true,
      sessions: {
        where: { status: { in: ["OPEN", "BILL_REQUESTED"] } },
        orderBy: { openedAt: "desc" },
        take: 1,
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
          payments: true,
        },
      },
    },
  });

  if (!table) return apiError("TABLE_NOT_FOUND", "Table not found", 404);
  const session = table.sessions[0];
  if (!session) return apiError("NO_SESSION", "No open session", 400);

  let tabBalance = 0;
  let paidTotal = 0;
  for (const p of session.payments) {
    if (p.status === "COMPLETED") paidTotal += Number(p.amount);
  }

  const lines: string[] = [];
  for (const order of session.orders) {
    if (order.paymentMode === "ADD_TO_TAB" && !order.payment) {
      tabBalance += Number(order.subtotal);
    }
    lines.push(`Order #${order.orderNumber}`);
    for (const item of order.items) {
      const name =
        item.menuItem.translations.find((t) => t.locale === locale)?.name ??
        item.menuItem.translations[0]?.name ??
        "Item";
      const price = Number(item.unitPrice) * item.quantity;
      lines.push(`  ${item.quantity}× ${name}  ${money(price)}`);
      if (item.takeaway) lines.push(`     (TAKEAWAY)`);
      if (item.notes) lines.push(`     (${item.notes})`);
    }
    lines.push("");
  }

  const due = Math.max(0, tabBalance - paidTotal);
  const now = new Date();
  const text = [
    "================================",
    `  ${table.venue.name || venueName}`,
    `  TABLE ${table.number} · ${table.section}`,
    `  ${now.toLocaleString()}`,
    "================================",
    "",
    ...lines,
    "--------------------------------",
    `  Paid:     ${money(paidTotal)}`,
    `  DUE:      ${money(due)}`,
    "================================",
    "  Thank you",
    "",
  ].join("\n");

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Bill · Table ${table.number}</title>
<style>
  body { font-family: ui-monospace, Menlo, Consolas, monospace; padding: 24px; color: #111; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
  pre { white-space: pre-wrap; font-size: 13px; line-height: 1.45; }
  @media print { body { padding: 0; } .no-print { display: none; } }
</style></head><body>
<button class="no-print" onclick="window.print()" style="margin-bottom:16px;padding:8px 14px;font-weight:600;cursor:pointer">Print</button>
<h1>${table.venue.name || venueName}</h1>
<p class="meta">Table ${table.number} · ${table.section} · ${now.toLocaleString()}</p>
<pre>${text.replace(/</g, "&lt;")}</pre>
<script>window.onload=function(){setTimeout(function(){window.print()},250)}</script>
</body></html>`;

  // Mark bill requested so floor map shows purple
  await prisma.table.update({
    where: { id: tableId },
    data: { status: "BILL_REQUESTED" },
  });
  await prisma.session.update({
    where: { id: session.id },
    data: { status: "BILL_REQUESTED" },
  });

  const existing = await prisma.waiterAlert.findFirst({
    where: { tableId, type: "BILL_REQUESTED", read: false },
  });
  await suppressPartySizeAlert(tableId);
  if (!existing) {
    await prisma.waiterAlert.create({
      data: {
        tableId,
        sessionId: session.id,
        type: "BILL_REQUESTED",
        message: `Table ${table.number} — bill printed`,
      },
    });
  }

  publish(RealtimeEvents.SESSION_UPDATED, {
    sessionId: session.id,
    tableId,
    status: "BILL_REQUESTED",
  });

  // Best-effort push to edge receipt printer
  const edgeUrl = process.env.EDGE_SERVER_URL;
  let edgeQueued = false;
  if (edgeUrl) {
    try {
      const res = await fetch(`${edgeUrl.replace(/\/$/, "")}/api/v1/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: `bill-${session.id}`,
          tableNumber: table.number,
          section: table.section,
          orderNumber: 0,
          items: [
            {
              name: `BILL DUE ${money(due)}`,
              quantity: 1,
              notes: text.slice(0, 400),
              route: "BAR",
            },
          ],
          createdAt: now.toISOString(),
        }),
        signal: AbortSignal.timeout(2500),
      });
      edgeQueued = res.ok;
    } catch {
      edgeQueued = false;
    }
  }

  return Response.json({
    ok: true,
    tableNumber: table.number,
    due: due.toFixed(2),
    text,
    html,
    edgeQueued,
  });
}
