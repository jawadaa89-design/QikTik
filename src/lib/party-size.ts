import { prisma } from "@/lib/db";
import { apiError } from "@/lib/validation";
import { publish, RealtimeEvents } from "@/lib/realtime";

/** Re-show guest-count alert if still missing (after other alerts fade / time passes). */
export const PARTY_SIZE_REMIND_MS = 3 * 60 * 1000;

export function missingPartySize(partySize: number | null | undefined) {
  return partySize == null || partySize < 1;
}

/** Higher-priority floor alerts should hide the party-size reminder. */
export function hasHigherPriorityFloorAlert(flags: {
  billRequested?: boolean;
  waiterCalled?: boolean;
  hasReady?: boolean;
}) {
  return Boolean(flags.billRequested || flags.waiterCalled || flags.hasReady);
}

/** Dismiss unread party-size alerts so another alert can take the floor. */
export async function suppressPartySizeAlert(tableId: string) {
  await prisma.waiterAlert.updateMany({
    where: { tableId, type: "PARTY_SIZE", read: false },
    data: { read: true },
  });
}

export async function ensurePartySizeAlert(tableId: string, sessionId: string) {
  const existing = await prisma.waiterAlert.findFirst({
    where: { tableId, type: "PARTY_SIZE", read: false },
  });
  if (existing) return;

  await prisma.waiterAlert.create({
    data: {
      tableId,
      sessionId,
      type: "PARTY_SIZE",
      message: "Set number of guests at this table",
    },
  });

  publish(RealtimeEvents.ALERT_NEW, { tableId, type: "PARTY_SIZE" });
}

/**
 * Create or refresh the party-size reminder when still missing.
 * Skips (and suppresses) while a higher-priority alert is active.
 * Re-fires after PARTY_SIZE_REMIND_MS even if a previous alert was dismissed.
 */
export async function maybeRemindPartySizeAlert(
  tableId: string,
  sessionId: string,
  options: {
    needsParty: boolean;
    higherPriority: boolean;
  }
): Promise<{ showPartySizeAlert: boolean }> {
  if (!options.needsParty) {
    await suppressPartySizeAlert(tableId);
    return { showPartySizeAlert: false };
  }

  if (options.higherPriority) {
    await suppressPartySizeAlert(tableId);
    return { showPartySizeAlert: false };
  }

  const latest = await prisma.waiterAlert.findFirst({
    where: { tableId, type: "PARTY_SIZE" },
    orderBy: { createdAt: "desc" },
  });

  const ageMs = latest ? Date.now() - latest.createdAt.getTime() : Number.POSITIVE_INFINITY;
  const unread = Boolean(latest && !latest.read);

  if (unread && ageMs < PARTY_SIZE_REMIND_MS) {
    return { showPartySizeAlert: true };
  }

  if (ageMs < PARTY_SIZE_REMIND_MS) {
    // Recently overridden / cleared — wait before nagging again
    return { showPartySizeAlert: false };
  }

  if (unread) {
    await suppressPartySizeAlert(tableId);
  }

  await prisma.waiterAlert.create({
    data: {
      tableId,
      sessionId,
      type: "PARTY_SIZE",
      message: "Set number of guests at this table",
    },
  });
  publish(RealtimeEvents.ALERT_NEW, { tableId, type: "PARTY_SIZE" });

  return { showPartySizeAlert: true };
}

export async function clearPartySizeAlert(tableId: string) {
  await suppressPartySizeAlert(tableId);
}

/** Returns an error Response if party size is missing; otherwise null. */
export function partySizeRequiredResponse(partySize: number | null | undefined) {
  if (!missingPartySize(partySize)) return null;
  return apiError(
    "PARTY_SIZE_REQUIRED",
    "Waiter must set the number of guests before this table can be closed",
    409
  );
}
