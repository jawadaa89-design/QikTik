import { prisma } from "@/lib/db";
import { publish, RealtimeEvents } from "@/lib/realtime";

/** Auto-complete READY tickets that staff never marked picked up. */
export const READY_AUTO_COMPLETE_MS = 30 * 60 * 1000;

const EXPIRE_THROTTLE_MS = 20_000;

const g = globalThis as unknown as { __qiktikPickupExpireAt?: number };

/**
 * Mark stale READY pickup tickets as COMPLETED so they leave the staff board.
 * Throttled so frequent board refreshes do not hammer the DB.
 */
export async function expireStaleReadyPickupTickets(opts?: {
  venueId?: string;
  force?: boolean;
}): Promise<number> {
  const now = Date.now();
  const last = g.__qiktikPickupExpireAt ?? 0;
  if (!opts?.force && now - last < EXPIRE_THROTTLE_MS) return 0;
  g.__qiktikPickupExpireAt = now;

  const cutoff = new Date(now - READY_AUTO_COMPLETE_MS);
  const stale = await prisma.pickupTicket.findMany({
    where: {
      status: "READY",
      ...(opts?.venueId ? { venueId: opts.venueId } : {}),
      OR: [
        { readyAt: { lte: cutoff } },
        { readyAt: null, updatedAt: { lte: cutoff } },
      ],
    },
    take: 100,
    orderBy: { readyAt: "asc" },
  });

  if (stale.length === 0) return 0;

  let completed = 0;
  for (const ticket of stale) {
    try {
      const updated = await prisma.pickupTicket.update({
        where: { id: ticket.id },
        data: { status: "COMPLETED" },
      });
      completed += 1;
      publish(RealtimeEvents.PICKUP_UPDATED, {
        id: updated.id,
        status: updated.status,
        customerName: updated.customerName,
        orderRef: updated.orderRef,
        phone: updated.phone,
        readyAt: updated.readyAt?.toISOString() ?? null,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      });
    } catch {
      /* skip raced / deleted rows */
    }
  }

  if (completed > 0) {
    console.info(
      `[pickup-expire] auto-completed ${completed} READY ticket(s) older than ${READY_AUTO_COMPLETE_MS / 60_000}m`
    );
  }

  return completed;
}
