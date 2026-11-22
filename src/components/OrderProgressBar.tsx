"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const STEPS = ["received", "preparing", "ready", "served"] as const;
const STEP_INDEX: Record<string, number> = {
  RECEIVED: 0,
  PREPARING: 1,
  READY: 2,
  SERVED: 3,
  CANCELLED: -1,
};

type Props = {
  name: string;
  status: string;
  notes?: string | null;
  takeaway?: boolean;
  compact?: boolean;
};

export function OrderProgressBar({ name, status, notes, takeaway, compact }: Props) {
  const t = useTranslations("order.progress");
  const tOrder = useTranslations("order");
  const current = STEP_INDEX[status] ?? 0;

  return (
    <div className={cn("guest-panel rounded-2xl p-4", !compact && "animate-rise")}>
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-ink">{name}</p>
          {takeaway ? (
            <p className="mt-1 text-sm font-semibold text-brass">{tOrder("takeaway")}</p>
          ) : null}
          {notes ? (
            <p className="mt-1 text-sm text-brass/90">
              <span className="text-ink-soft/50">{tOrder("notes")}: </span>
              {notes}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 rounded-md border border-brass/30 bg-brass/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brass">
          {status === "CANCELLED" ? "—" : t(STEPS[Math.max(0, current)] ?? "received")}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {STEPS.map((step, i) => (
          <div key={step} className="flex flex-1 flex-col gap-1.5">
            <div className="h-1.5 overflow-hidden rounded-sm bg-white/10">
              <div
                className={cn(
                  "h-full w-full rounded-sm bg-gradient-to-r from-brass to-brass-deep progress-fill",
                  i > current && "opacity-0"
                )}
                style={{ animationDelay: `${i * 80}ms` }}
              />
            </div>
            {!compact && (
              <span
                className={cn(
                  "text-center text-[10px] tracking-wide",
                  i <= current ? "font-semibold text-ink-soft" : "text-ink-soft/30"
                )}
              >
                {t(step)}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
