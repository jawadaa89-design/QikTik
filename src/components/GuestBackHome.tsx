"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useVenueSlug } from "@/components/VenueProvider";
import { venueMainPath } from "@/lib/venue-paths";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
};

/** Compact ← home control under language / QikTik logo (flips in RTL). */
export function GuestBackHome({ className }: Props) {
  const t = useTranslations("pickup");
  const locale = useLocale();
  const venueSlug = useVenueSlug();

  return (
    <Link
      href={venueMainPath(venueSlug, locale)}
      aria-label={t("backHome")}
      className={cn(
        "inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/12 bg-white/[0.04] text-ink-soft transition hover:border-brass/40 hover:bg-brass/10 hover:text-brass",
        className
      )}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
        className="rtl:rotate-180"
      >
        <path
          d="M15 5.5 8.5 12 15 18.5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </Link>
  );
}
