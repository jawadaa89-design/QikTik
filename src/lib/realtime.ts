/** In-process pub/sub for local live updates (Next.js single process). */

type Handler = (payload: unknown) => void;

const g = globalThis as unknown as { __qiktikBus?: Map<string, Set<Handler>> };

function bus() {
  if (!g.__qiktikBus) g.__qiktikBus = new Map();
  return g.__qiktikBus;
}

export function publish(event: string, payload: unknown) {
  const handlers = bus().get(event);
  if (handlers) {
    for (const h of handlers) {
      try {
        h(payload);
      } catch {
        // ignore listener errors
      }
    }
  }
  // Always fan-out to wildcard (SSE /api/v1/events listens on "*").
  // Do not return early when there are no named subscribers — that dropped
  // pickup:call-waiter / pickup:ping and every other broadcast-only event.
  const all = bus().get("*");
  if (all) {
    for (const h of all) {
      try {
        h({ event, payload });
      } catch {
        /* ignore */
      }
    }
  }
}

export function subscribe(event: string, handler: Handler): () => void {
  const map = bus();
  if (!map.has(event)) map.set(event, new Set());
  map.get(event)!.add(handler);
  return () => map.get(event)?.delete(handler);
}

export const RealtimeEvents = {
  ORDER_NEW: "order:new",
  ORDER_ITEM_STATUS: "order:item:status",
  SESSION_UPDATED: "session:updated",
  ALERT_NEW: "alert:new",
  PAYMENT_COMPLETED: "payment:completed",
  PICKUP_UPDATED: "pickup:updated",
  PICKUP_PING: "pickup:ping",
  PICKUP_CALL_WAITER: "pickup:call-waiter",
  PICKUP_ASSISTANCE_UPDATED: "pickup:assistance-updated",
} as const;
