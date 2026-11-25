"use client";

import { useCallback, useState } from "react";
import type { PackageId } from "@/lib/features";
import {
  venueLinkLabelsForPackage,
  venuePublicUrls,
  type VenueLinkKey,
} from "@/lib/platform-auth";
import {
  downloadBlob,
  renderVenueSummaryPng,
} from "@/lib/venue-summary-image";
import { toAbsoluteUrl } from "@/lib/to-absolute-url";

export type VenueSummaryLabels = {
  exportSummary: string;
  exportSummaryBusy: string;
  exportSummaryError: string;
  linkLabels: Partial<Record<VenueLinkKey, string>>;
};

type Props = {
  /** Fallback slug if live fetch fails */
  slug: string;
  /** Fallback name */
  venueName?: string;
  /** Fallback package */
  packageId?: PackageId;
  /** Fallback logo */
  logoUrl?: string | null;
  /** Resolve localized package name for whatever package is live right now */
  packageLabelFor: (id: PackageId) => string;
  labels: VenueSummaryLabels;
  className?: string;
};

type FeaturesPayload = {
  packageId?: PackageId;
};

type DashboardPayload = {
  venue?: { name?: string; currency?: string } | null;
  menuGuestUrl?: string;
  alertsBoardUrl?: string;
};

type BrandingPayload = {
  branding?: { logoUrl?: string | null };
  venue?: { name?: string; slug?: string; branding?: { logoUrl?: string | null } };
};

function withCacheBust(url: string): string {
  const raw = url.trim();
  if (!raw) return raw;
  const sep = raw.includes("?") ? "&" : "?";
  return `${raw}${sep}_t=${Date.now()}`;
}

/**
 * Builds a fresh PNG on every click from live APIs (package, logo, links, QR).
 * Nothing is cached as a static summary file.
 */
export function VenueSummaryExport({
  slug: fallbackSlug,
  venueName: fallbackName,
  packageId: fallbackPackageId = "menu_only",
  logoUrl: fallbackLogo,
  packageLabelFor,
  labels,
  className = "",
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onExport = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const qs = fallbackSlug
        ? `?venue=${encodeURIComponent(fallbackSlug)}`
        : "";

      const [featuresRes, dashRes, brandRes] = await Promise.all([
        fetch(`/api/v1/features${qs}`, { cache: "no-store" }),
        fetch("/api/v1/admin/dashboard", { cache: "no-store" }),
        fetch("/api/v1/admin/venue/branding", { cache: "no-store" }),
      ]);

      const features = featuresRes.ok
        ? ((await featuresRes.json()) as FeaturesPayload)
        : null;
      const dash = dashRes.ok
        ? ((await dashRes.json()) as DashboardPayload)
        : null;
      const brand = brandRes.ok
        ? ((await brandRes.json()) as BrandingPayload)
        : null;

      const livePackageId: PackageId =
        features?.packageId ?? fallbackPackageId;
      const liveSlug =
        brand?.venue?.slug?.trim() || fallbackSlug;
      const liveName =
        brand?.venue?.name?.trim() ||
        dash?.venue?.name?.trim() ||
        fallbackName ||
        "Venue";
      const liveLogo =
        brand?.branding?.logoUrl ||
        brand?.venue?.branding?.logoUrl ||
        fallbackLogo ||
        "/logo.png";

      const urls = venuePublicUrls(liveSlug);
      const resolved: Record<VenueLinkKey, string> = {
        menu: dash?.menuGuestUrl?.trim() || toAbsoluteUrl(urls.menu),
        admin: toAbsoluteUrl(urls.admin),
        staffPickup:
          dash?.alertsBoardUrl?.trim() || toAbsoluteUrl(urls.staffPickup),
        alerts: dash?.alertsBoardUrl?.trim() || toAbsoluteUrl(urls.alerts),
        kitchen: toAbsoluteUrl(urls.kitchen),
        waiter: toAbsoluteUrl(urls.waiter),
      };

      const links = venueLinkLabelsForPackage(livePackageId).map(
        ({ key, label }) => ({
          label: labels.linkLabels[key] || label,
          url: resolved[key],
        })
      );

      const blob = await renderVenueSummaryPng({
        venueName: liveName,
        slug: liveSlug,
        packageLabel: packageLabelFor(livePackageId),
        logoUrl: withCacheBust(liveLogo),
        links,
      });

      const safe = (liveSlug || liveName || "venue")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 40);
      const stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `qiktik-${safe || "venue"}-summary-${stamp}.png`);
    } catch (err) {
      console.error("[VenueSummaryExport]", err);
      setError(labels.exportSummaryError);
    } finally {
      setBusy(false);
    }
  }, [
    fallbackSlug,
    fallbackName,
    fallbackPackageId,
    fallbackLogo,
    packageLabelFor,
    labels,
  ]);

  return (
    <div className={className}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void onExport()}
        className="rounded-xl border border-brass/40 bg-brass/15 px-4 py-2.5 text-sm font-bold text-brass disabled:opacity-60"
      >
        {busy ? labels.exportSummaryBusy : labels.exportSummary}
      </button>
      {error ? (
        <p className="mt-2 text-xs font-semibold text-red-300/90">{error}</p>
      ) : null}
    </div>
  );
}
