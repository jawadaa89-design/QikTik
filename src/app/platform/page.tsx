"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { QikTikLogo } from "@/components/QikTikLogo";
import { LinkQrActions } from "@/components/LinkQrActions";
import type { PackageId } from "@/lib/features";
import { venueLinkLabelsForPackage } from "@/lib/platform-auth";
import {
  clearPlatformPassword,
  getPlatformPassword,
  setPlatformPassword,
} from "@/lib/platform-session";

type VenueUrls = {
  menu: string;
  admin: string;
  staffPickup: string;
  alerts: string;
  kitchen: string;
  waiter: string;
};

type VenueRow = {
  id: string;
  name: string;
  slug: string;
  packageId?: PackageId;
  branding?: { logoUrl: string | null; accentColor: string };
  urls: VenueUrls;
  createdAt?: string;
};

const PACKAGES: { id: PackageId; label: string }[] = [
  { id: "menu_only", label: "Menu only" },
  { id: "menu_alerts", label: "Menu + alerts" },
  { id: "menu_alerts_pickup", label: "Menu + alerts + pickup" },
  { id: "menu_ordering", label: "Full (menu + ordering + alerts + pickup)" },
];

const PACKAGE_LABEL: Record<PackageId, string> = Object.fromEntries(
  PACKAGES.map((p) => [p.id, p.label])
) as Record<PackageId, string>;

export default function PlatformPage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [venues, setVenues] = useState<VenueRow[]>([]);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [resetPwById, setResetPwById] = useState<Record<string, string>>({});
  const [resetBusyId, setResetBusyId] = useState<string | null>(null);
  const [resetMsgById, setResetMsgById] = useState<Record<string, string>>({});
  const [pkgDraftById, setPkgDraftById] = useState<Record<string, PackageId>>({});
  const [pkgBusyId, setPkgBusyId] = useState<string | null>(null);
  const [pkgMsgById, setPkgMsgById] = useState<Record<string, string>>({});

  const loadVenues = useCallback(async (platformPassword: string) => {
    setListBusy(true);
    setListError(null);
    try {
      const res = await fetch(
        `/api/v1/platform/venues?password=${encodeURIComponent(platformPassword)}`
      );
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setListError(data?.error?.message || "Could not load restaurants");
        setUnlocked(false);
        setVenues([]);
        clearPlatformPassword();
        return false;
      }
      setVenues((data.venues as VenueRow[]) || []);
      setPassword(platformPassword);
      setPlatformPassword(platformPassword);
      setUnlocked(true);
      return true;
    } catch {
      setListError("Network error");
      setUnlocked(false);
      return false;
    } finally {
      setListBusy(false);
    }
  }, []);

  useEffect(() => {
    const saved = getPlatformPassword();
    if (saved) void loadVenues(saved);
  }, [loadVenues]);

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    await loadVenues(password);
  }

  async function resetStaffPassword(venue: VenueRow) {
    const next = (resetPwById[venue.id] || "").trim();
    if (next.length < 4) {
      setResetMsgById((m) => ({
        ...m,
        [venue.id]: "Password must be at least 4 characters",
      }));
      return;
    }
    setResetBusyId(venue.id);
    setResetMsgById((m) => ({ ...m, [venue.id]: "" }));
    try {
      const res = await fetch("/api/v1/platform/venues/staff-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          venueId: venue.id,
          staffPassword: next,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setResetMsgById((m) => ({
          ...m,
          [venue.id]: data?.error?.message || "Reset failed",
        }));
        return;
      }
      setResetPwById((m) => ({ ...m, [venue.id]: "" }));
      setResetMsgById((m) => ({
        ...m,
        [venue.id]: "Staff password updated",
      }));
    } catch {
      setResetMsgById((m) => ({ ...m, [venue.id]: "Network error" }));
    } finally {
      setResetBusyId(null);
    }
  }

  async function activatePackage(venue: VenueRow) {
    const next =
      pkgDraftById[venue.id] || venue.packageId || ("menu_only" as PackageId);
    if (next === venue.packageId) {
      setPkgMsgById((m) => ({
        ...m,
        [venue.id]: "Already on this package",
      }));
      return;
    }
    setPkgBusyId(venue.id);
    setPkgMsgById((m) => ({ ...m, [venue.id]: "" }));
    try {
      const res = await fetch("/api/v1/platform/venues/package", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password,
          venueId: venue.id,
          packageId: next,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setPkgMsgById((m) => ({
          ...m,
          [venue.id]: data?.error?.message || "Package update failed",
        }));
        return;
      }
      setVenues((list) =>
        list.map((row) =>
          row.id === venue.id
            ? { ...row, packageId: (data.packageId as PackageId) || next }
            : row
        )
      );
      setPkgDraftById((m) => ({ ...m, [venue.id]: next }));
      setPkgMsgById((m) => ({
        ...m,
        [venue.id]: `Activated: ${PACKAGE_LABEL[next]}`,
      }));
    } catch {
      setPkgMsgById((m) => ({ ...m, [venue.id]: "Network error" }));
    } finally {
      setPkgBusyId(null);
    }
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-2xl px-4 py-10">
      <QikTikLogo className="absolute end-4 top-4" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass">
        Platform
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
        Restaurants
      </h1>
      <p className="mt-2 text-sm text-ink-soft/65">
        Unlock to list every venue, copy links, and reset staff passwords.
      </p>

      {!unlocked ? (
        <form
          onSubmit={onUnlock}
          className="guest-panel mt-8 space-y-4 rounded-2xl p-5"
        >
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">
              Platform password
            </span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
              autoComplete="off"
            />
          </label>
          {listError ? (
            <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
              {listError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={listBusy}
            className="btn-primary w-full px-4 py-3 text-sm font-bold disabled:opacity-55"
          >
            {listBusy ? "Loading…" : "Unlock platform"}
          </button>
        </form>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-soft/70">
              {venues.length} restaurant{venues.length === 1 ? "" : "s"}
            </p>
            <Link
              href="/platform/new"
              className="rounded-xl bg-brass px-3 py-1.5 text-xs font-bold text-[#0c100e] hover:brightness-105"
            >
              Create restaurant
            </Link>
            <button
              type="button"
              onClick={() => loadVenues(password)}
              disabled={listBusy}
              className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[#f2efe8] hover:border-brass/40 disabled:opacity-55"
            >
              {listBusy ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={() => {
                setUnlocked(false);
                setVenues([]);
                setPassword("");
                clearPlatformPassword();
              }}
              className="rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-ink-soft/70 hover:text-[#f2efe8]"
            >
              Lock
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {venues.map((v) => {
              const logo = v.branding?.logoUrl || "/logo.png";
              const accent = v.branding?.accentColor || "#c4a35a";
              const pkg =
                (v.packageId && PACKAGE_LABEL[v.packageId]) || "Package";
              const resetMsg = resetMsgById[v.id];
              const pkgDraft =
                pkgDraftById[v.id] || v.packageId || ("menu_only" as PackageId);
              const pkgMsg = pkgMsgById[v.id];
              return (
                <section
                  key={v.id}
                  className="guest-panel rounded-2xl p-5"
                >
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={logo}
                      alt=""
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-full object-cover bg-[#f6f3ee]"
                      style={{ border: `2px solid ${accent}` }}
                    />
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate font-display text-xl font-semibold text-ink">
                        {v.name}
                      </h2>
                      <p className="mt-0.5 text-xs text-ink-soft/55">
                        <code className="text-brass">/r/{v.slug}</code>
                        {" · "}
                        {pkg}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {venueLinkLabelsForPackage(v.packageId).map(
                      ({ key, label }) => {
                        const href = v.urls?.[key];
                        if (!href) return null;
                        return (
                          <div
                            key={key}
                            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-soft/45">
                                {label}
                              </span>
                              <LinkQrActions
                                href={href}
                                label={`${v.name} · ${label}`}
                                compact
                              />
                            </div>
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="mt-1 block break-all text-xs text-brass hover:underline"
                            >
                              {href}
                            </a>
                          </div>
                        );
                      }
                    )}
                  </div>

                  <div className="mt-4 border-t border-white/8 pt-4">
                    <p className="text-xs font-semibold text-ink-soft">
                      Activate package
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-soft/45">
                      Venue admins request upgrades by email; only platform can turn them on.
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <select
                        value={pkgDraft}
                        onChange={(e) =>
                          setPkgDraftById((m) => ({
                            ...m,
                            [v.id]: e.target.value as PackageId,
                          }))
                        }
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-[#1a211c] px-3 py-2.5 text-sm text-[#f2efe8] outline-none focus:border-brass/40"
                      >
                        {PACKAGES.map((p) => (
                          <option
                            key={p.id}
                            value={p.id}
                            className="bg-white text-[#111111]"
                            style={{ backgroundColor: "#ffffff", color: "#111111" }}
                          >
                            {p.label}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={pkgBusyId === v.id || pkgDraft === v.packageId}
                        onClick={() => void activatePackage(v)}
                        className="rounded-xl bg-brass px-4 py-2.5 text-sm font-bold text-[#0c100e] disabled:opacity-55"
                      >
                        {pkgBusyId === v.id ? "Saving…" : "Activate"}
                      </button>
                    </div>
                    {pkgMsg ? (
                      <p
                        className={`mt-2 text-xs ${
                          pkgMsg.startsWith("Activated")
                            ? "text-brass"
                            : "text-alert"
                        }`}
                      >
                        {pkgMsg}
                      </p>
                    ) : null}
                  </div>

                  <div className="mt-4 border-t border-white/8 pt-4">
                    <p className="text-xs font-semibold text-ink-soft">
                      Reset staff password
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        type="password"
                        value={resetPwById[v.id] || ""}
                        onChange={(e) =>
                          setResetPwById((m) => ({
                            ...m,
                            [v.id]: e.target.value,
                          }))
                        }
                        placeholder="New staff password"
                        minLength={4}
                        autoComplete="new-password"
                        className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#f2efe8] outline-none focus:border-brass/40"
                      />
                      <button
                        type="button"
                        disabled={resetBusyId === v.id}
                        onClick={() => void resetStaffPassword(v)}
                        className="rounded-xl bg-brass px-4 py-2.5 text-sm font-bold text-[#0c100e] disabled:opacity-55"
                      >
                        {resetBusyId === v.id ? "Saving…" : "Reset"}
                      </button>
                    </div>
                    {resetMsg ? (
                      <p
                        className={`mt-2 text-xs ${
                          resetMsg.includes("updated")
                            ? "text-brass"
                            : "text-alert"
                        }`}
                      >
                        {resetMsg}
                      </p>
                    ) : null}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
