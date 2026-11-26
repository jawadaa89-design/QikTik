"use client";

import { useEffect, useRef, useState } from "react";

const PULL_THRESHOLD_PX = 72;
const MAX_PULL_PX = 120;

/** True scroll position for guest pages and the window. */
function pageScrollTop(): number {
  const theme = document.querySelector(".venue-theme") as HTMLElement | null;
  const mainCol = document.querySelector(
    "[data-qiktik-scroll]"
  ) as HTMLElement | null;
  const themeTop = theme?.scrollTop ?? 0;
  const colTop = mainCol?.scrollTop ?? 0;
  const winTop =
    window.scrollY ||
    document.documentElement.scrollTop ||
    document.body.scrollTop ||
    0;
  return Math.max(themeTop, colTop, winTop);
}

/** Any scrollable ancestor of the touch target that still has room above. */
function scrollParentNotAtTop(target: EventTarget | null): boolean {
  let el =
    target instanceof Element
      ? target
      : target instanceof Node
        ? target.parentElement
        : null;
  while (el && el !== document.documentElement) {
    const style = window.getComputedStyle(el);
    const oy = style.overflowY;
    const canScroll =
      (oy === "auto" || oy === "scroll" || oy === "overlay") &&
      el.scrollHeight > el.clientHeight + 1;
    if (canScroll && el.scrollTop > 1) return true;
    el = el.parentElement;
  }
  return false;
}

/**
 * Pull-down-to-refresh for phones / PWAs (standalone often disables native PTR).
 * Reloads the page when the user pulls past the threshold while already at the top.
 */
export function MobilePullToRefresh() {
  const startY = useRef(0);
  const pulling = useRef(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const coarse =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(pointer: coarse)").matches;
    if (!coarse) return;

    const atPageTop = (target: EventTarget | null) =>
      pageScrollTop() <= 1 && !scrollParentNotAtTop(target);

    const onStart = (e: TouchEvent) => {
      if (refreshing) return;
      // Only arm PTR when every scroll container is already at the top
      if (!atPageTop(e.target)) {
        pulling.current = false;
        return;
      }
      startY.current = e.touches[0]?.clientY ?? 0;
      pulling.current = true;
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling.current || refreshing) return;
      if (!atPageTop(e.target)) {
        pulling.current = false;
        setPull(0);
        return;
      }
      const y = e.touches[0]?.clientY ?? 0;
      const delta = y - startY.current;
      if (delta <= 0) {
        setPull(0);
        return;
      }
      // Resist the pull so it feels natural
      const resisted = Math.min(MAX_PULL_PX, delta * 0.45);
      setPull(resisted);
      if (resisted > 8 && e.cancelable) {
        e.preventDefault();
      }
    };

    const onEnd = () => {
      if (!pulling.current) return;
      pulling.current = false;
      setPull((current) => {
        if (current >= PULL_THRESHOLD_PX && !refreshing) {
          setRefreshing(true);
          window.setTimeout(() => {
            window.location.reload();
          }, 180);
          return PULL_THRESHOLD_PX;
        }
        return 0;
      });
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [refreshing]);

  const visible = pull > 4 || refreshing;
  const progress = Math.min(1, pull / PULL_THRESHOLD_PX);

  if (!visible) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147482000,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        paddingTop: "max(8px, env(safe-area-inset-top))",
        transform: `translateY(${Math.max(0, pull - 28)}px)`,
        opacity: refreshing ? 1 : 0.35 + progress * 0.65,
        transition: refreshing ? "none" : "transform 160ms ease, opacity 160ms ease",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 999,
          border: "2px solid rgba(196,163,90,0.35)",
          borderTopColor: "#c4a35a",
          background: "rgba(12,16,14,0.72)",
          boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
          transform: refreshing ? undefined : `rotate(${progress * 270}deg)`,
          animation: refreshing ? "qiktik-ptr-spin 0.7s linear infinite" : undefined,
        }}
      />
      <style>{`
        @keyframes qiktik-ptr-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
