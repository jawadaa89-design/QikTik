import { prisma } from "@/lib/db";
import { publish, RealtimeEvents } from "@/lib/realtime";

/** Auto-complete READY tickets / ACKNOWLEDGED waiter calls that staff never closed. */
export const STAFF_BOARD_AUTO_CLEANUP_MS = 30 * 60 * 1000;

/** @deprecated Use STAFF_BOARD_AUTO_CLEANUP_MS */
export const READY_AUTO_COMPLETE_MS = STAFF_BOARD_AUTO_CLEANUP_MS;

const EXPIRE_THROTTLE_MS = 20_000;

const g = globalThis as unknown as { __qiktikPickupExpireAt?: number };

function serializeTicket(ticket: {
  id: string;
  status: string;
  customerName: string;
  orderRef: string | null;
  phone: string | null;
  readyAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: ticket.id,
    status: ticket.status,
    customerName: ticket.customerName,
    orderRef: ticket.orderRef,
    phone: ticket.phone,
    readyAt: ticket.readyAt?.toISOString() ?? null,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}

/**
 * Mark stale READY pickup tickets as COMPLETED so they leave the staff board.
 */
export async function expireStaleReadyPickupTickets(opts?: {
  venueId?: string;
}): Promise<number> {
  const cutoff = new Date(Date.now() - STAFF_BOARD_AUTO_CLEANUP_MS);
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
      publish(RealtimeEvents.PICKUP_UPDATED, serializeTicket(updated));
    } catch {
      /* skip raced / deleted rows */
    }
  }

  if (completed > 0) {
    console.info(
      `[pickup-expire] auto-completed ${completed} READY ticket(s) older than ${STAFF_BOARD_AUTO_CLEANUP_MS / 60_000}m`
    );
  }

  return completed;
}

/**
 * Mark ACKNOWLEDGED waiter-call rows as DONE after 30 minutes so they leave the board.
 * Uses updatedAt (set when staff tapped Acknowledge).
 */
export async function expireStaleAcknowledgedAssistance(opts?: {
  venueId?: string;
}): Promise<number> {
  const cutoff = new Date(Date.now() - STAFF_BOARD_AUTO_CLEANUP_MS);
  const stale = await prisma.pickupAssistanceCall.findMany({
    where: {
      status: "ACKNOWLEDGED",
      updatedAt: { lte: cutoff },
      ...(opts?.venueId ? { venueId: opts.venueId } : {}),
    },
    take: 100,
    orderBy: { updatedAt: "asc" },
  });

  if (stale.length === 0) return 0;

  let done = 0;
  for (const call of stale) {
    try {
      const updated = await prisma.pickupAssistanceCall.update({
        where: { id: call.id },
        data: { status: "DONE" },
      });
      done += 1;
      publish(RealtimeEvents.PICKUP_ASSISTANCE_UPDATED, {
        id: updated.id,
        venueId: updated.venueId,
        status: updated.status,
        customerName: updated.customerName,
        orderRef: updated.orderRef,
        comment: updated.comment,
      });
    } catch {
      /* skip raced / deleted rows */
    }
  }

  if (done > 0) {
    console.info(
      `[pickup-expire] auto-closed ${done} ACKNOWLEDGED waiter call(s) older than ${STAFF_BOARD_AUTO_CLEANUP_MS / 60_000}m`
    );
  }

  return done;
}

/**
 * Delete table-side WaiterAlert rows that were marked read more than 30 minutes ago
 * (by createdAt — already hidden from the live queue once read=true).
 */
export async function expireStaleReadWaiterAlerts(opts?: {
  venueId?: string;
}): Promise<number> {
  const cutoff = new Date(Date.now() - STAFF_BOARD_AUTO_CLEANUP_MS);

  if (opts?.venueId) {
    const tables = await prisma.table.findMany({
      where: { venueId: opts.venueId },
      select: { id: true },
    });
    if (tables.length === 0) return 0;
    const result = await prisma.waiterAlert.deleteMany({
      where: {
        read: true,
        createdAt: { lte: cutoff },
        tableId: { in: tables.map((t) => t.id) },
      },
    });
    return result.count;
  }

  const result = await prisma.waiterAlert.deleteMany({
    where: {
      read: true,
      createdAt: { lte: cutoff },
    },
  });
  return result.count;
}

/**
 * Run all board cleanups (throttled). Call from staff board loads / queue GETs.
 */
export async function expireStaleStaffBoardItems(opts?: {
  venueId?: string;
  force?: boolean;
}): Promise<{ ready: number; assistance: number; waiterAlerts: number }> {
  const now = Date.now();
  const last = g.__qiktikPickupExpireAt ?? 0;
  if (!opts?.force && now - last < EXPIRE_THROTTLE_MS) {
    return { ready: 0, assistance: 0, waiterAlerts: 0 };
  }
  g.__qiktikPickupExpireAt = now;

  const [ready, assistance, waiterAlerts] = await Promise.all([
    expireStaleReadyPickupTickets({ venueId: opts?.venueId }),
    expireStaleAcknowledgedAssistance({ venueId: opts?.venueId }),
    expireStaleReadWaiterAlerts({ venueId: opts?.venueId }).catch(() => 0),
  ]);

  return { ready, assistance, waiterAlerts };
}
