"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type MouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { toAbsoluteUrl } from "@/lib/to-absolute-url";

type Props = {
  href: string;
  /** Used in download filename + modal title */
  label?: string;
  /** Compact = icon-sized buttons (tables column) */
  compact?: boolean;
  className?: string;
};

/**
 * QR view + download for listed links.
 * Image comes from /api/v1/qr (reliable); modal portals above the page.
 */
export function LinkQrActions({
  href,
  label = "Link",
  compact = false,
  className = "",
}: Props) {
  const dialogId = useId();
  const [open, setOpen] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const absolute = useMemo(() => toAbsoluteUrl(href || "/"), [href]);
  const qrSrc = useMemo(
    () => `/api/v1/qr?url=${encodeURIComponent(absolute)}`,
    [absolute]
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function openModal(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setOpen(true);
  }

  const download = useCallback(async () => {
    try {
      const res = await fetch(qrSrc);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const safe = (label || "link")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `qiktik-qr-${safe || "link"}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      console.error("[LinkQrActions] download failed", err);
    }
  }, [qrSrc, label]);

  const modal =
    open && portalReady
      ? createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogId}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 2147483000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 16,
              background: "rgba(0,0,0,0.78)",
            }}
            onClick={() => setOpen(false)}
          >
            <div
              style={{
                width: "100%",
                maxWidth: 384,
                maxHeight: "92dvh",
                overflowY: "auto",
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "#141a17",
                color: "#f2efe8",
                padding: 20,
                boxShadow: "0 24px 80px rgba(0,0,0,0.55)",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p
                id={dialogId}
                style={{
                  margin: 0,
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "#c4a35a",
                }}
              >
                QR code
              </p>
              <h3
                style={{
                  margin: "6px 0 0",
                  fontSize: 18,
                  fontWeight: 600,
                  lineHeight: 1.3,
                }}
              >
                {label}
              </h3>
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "rgba(200,196,187,0.85)",
                  wordBreak: "break-all",
                }}
              >
                {absolute}
              </p>

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  justifyContent: "center",
                  borderRadius: 12,
                  background: "#fff",
                  padding: 20,
                  minHeight: 280,
                  alignItems: "center",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={qrSrc}
                  src={qrSrc}
                  alt={`QR for ${label}`}
                  width={280}
                  height={280}
                  style={{
                    width: 280,
                    height: 280,
                    maxWidth: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>

              <div
                style={{
                  marginTop: 16,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => void download()}
                  style={{
                    flex: 1,
                    minHeight: 44,
                    border: "none",
                    borderRadius: 12,
                    padding: "10px 16px",
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: "pointer",
                    background: "#c4a35a",
                    color: "#0c100e",
                  }}
                >
                  Download PNG
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  style={{
                    minHeight: 44,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.15)",
                    padding: "10px 16px",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: "transparent",
                    color: "#f2efe8",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <button
        type="button"
        onClick={openModal}
        className={
          compact
            ? "rounded-lg border border-brass/35 bg-brass/10 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-brass"
            : "rounded-lg border border-brass/35 bg-brass/10 px-3 py-1.5 text-xs font-bold text-brass"
        }
      >
        QR
      </button>
      {modal}
    </span>
  );
}
