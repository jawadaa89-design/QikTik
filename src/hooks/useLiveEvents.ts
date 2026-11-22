"use client";

import { useEffect, useRef } from "react";

/** Subscribe to SSE live events; falls back silently if unavailable. */
export function useLiveEvents(onEvent: (event: string, data: unknown) => void) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    let es: EventSource | null = null;
    let closed = false;

    function connect() {
      if (closed) return;
      es = new EventSource("/api/v1/events");

      const forward = (event: string) => (e: MessageEvent) => {
        try {
          let data: unknown = e.data;
          try {
            data = JSON.parse(e.data);
          } catch {
            /* keep raw */
          }
          handler.current(event, data);
        } catch {
          /* ignore handler errors */
        }
      };

      es.addEventListener("connected", forward("connected"));
      es.addEventListener("order:new", forward("order:new"));
      es.addEventListener("order:item:status", forward("order:item:status"));
      es.addEventListener("session:updated", forward("session:updated"));
      es.addEventListener("alert:new", forward("alert:new"));
      es.addEventListener("payment:completed", forward("payment:completed"));
      es.addEventListener("pickup:updated", forward("pickup:updated"));
      es.addEventListener("pickup:ping", forward("pickup:ping"));
      es.addEventListener("pickup:call-waiter", forward("pickup:call-waiter"));
      es.addEventListener("pickup:assistance-updated", forward("pickup:assistance-updated"));

      es.onerror = () => {
        es?.close();
        setTimeout(connect, 3000);
      };
    }

    connect();
    return () => {
      closed = true;
      es?.close();
    };
  }, []);
}
