"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { QikTikLogo } from "@/components/QikTikLogo";
import { LinkQrActions } from "@/components/LinkQrActions";
import type { PackageId } from "@/lib/features";
import {
  clearPlatformPassword,
  getPlatformPassword,
  setPlatformPassword,
} from "@/lib/platform-session";
import { venueLinkLabelsForPackage } from "@/lib/platform-auth";
import { DEFAULT_VENUE_BRAND } from "@/lib/venue-brand";

type VenueUrls = {
  menu: string;
  admin: string;
  staffPickup: string;
  alerts: string;
  kitchen: string;
  waiter: string;
};

type Created = {
  id: string;
  name: string;
  slug: string;
  urls: VenueUrls;
};

const PACKAGES: { id: PackageId; label: string }[] = [
  { id: "menu_only", label: "Menu only" },
  { id: "menu_alerts", label: "Menu + alerts" },
  { id: "menu_alerts_pickup", label: "Menu + alerts + pickup" },
  { id: "menu_ordering", label: "Full (menu + ordering + alerts + pickup)" },
];

export default function PlatformNewVenuePage() {
  const [password, setPassword] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const [staffPassword, setStaffPassword] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [packageId, setPackageId] = useState<PackageId>("menu_only");
  const [accentColor, setAccentColor] = useState(DEFAULT_VENUE_BRAND.accentColor);
  const [backgroundColor, setBackgroundColor] = useState(
    DEFAULT_VENUE_BRAND.backgroundColor
  );
  const [surfaceColor, setSurfaceColor] = useState(DEFAULT_VENUE_BRAND.surfaceColor);
  const [textColor, setTextColor] = useState(DEFAULT_VENUE_BRAND.textColor);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  const logoPreview = useMemo(() => {
    if (!logoFile) return "/logo.png";
    return URL.createObjectURL(logoFile);
  }, [logoFile]);

  async function tryUnlock(platformPassword: string) {
    setUnlockBusy(true);
    setUnlockError(null);
    try {
      const res = await fetch(
        `/api/v1/platform/venues?password=${encodeURIComponent(platformPassword)}`
      );
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setUnlockError(data?.error?.message || "Wrong platform password");
        setUnlocked(false);
        clearPlatformPassword();
        return false;
      }
      setPassword(platformPassword);
      setPlatformPassword(platformPassword);
      setUnlocked(true);
      return true;
    } catch {
      setUnlockError("Network error");
      setUnlocked(false);
      return false;
    } finally {
      setUnlockBusy(false);
    }
  }

  useEffect(() => {
    const saved = getPlatformPassword();
    if (saved) void tryUnlock(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- unlock once on mount
  }, []);

  function onNameChange(value: string) {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
  }

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    await tryUnlock(password);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setCreated(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/platform/venues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          slug,
          packageId,
          password,
          staffPassword,
          accentColor,
          backgroundColor,
          surfaceColor,
          textColor,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message || "Could not create venue");
        return;
      }

      const venue = data.venue as Created;
      if (logoFile && venue?.id) {
        const form = new FormData();
        form.set("password", password);
        form.set("venueId", venue.id);
        form.set("file", logoFile);
        const logoRes = await fetch("/api/v1/platform/venues/logo", {
          method: "POST",
          body: form,
        });
        if (!logoRes.ok) {
          const logoData = await logoRes.json().catch(() => null);
          setError(
            logoData?.error?.message ||
              "Venue created, but logo upload failed — upload again from Admin → Branding"
          );
          setCreated(venue);
          return;
        }
      }

      setCreated(venue);
      setName("");
      setSlug("");
      setStaffPassword("");
      setLogoFile(null);
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-2xl px-4 py-10">
      <QikTikLogo className="absolute end-4 top-4" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass">
        Platform
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
        Create restaurant
      </h1>
      <p className="mt-2 text-sm text-ink-soft/65">
        New venues are available at{" "}
        <code className="text-brass">/r/&#123;slug&#125;/…</code>
      </p>
      <p className="mt-3 text-sm">
        <Link href="/platform" className="text-ink-soft/50 hover:text-brass">
          ← Back to restaurants
        </Link>
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
          {unlockError ? (
            <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
              {unlockError}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={unlockBusy}
            className="btn-primary w-full px-4 py-3 text-sm font-bold disabled:opacity-55"
          >
            {unlockBusy ? "Checking…" : "Unlock"}
          </button>
        </form>
      ) : (
        <>
          <form
            onSubmit={onSubmit}
            className="guest-panel mt-8 space-y-4 rounded-2xl p-5"
          >
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">
                Staff password for this restaurant
              </span>
              <input
                type="password"
                required
                minLength={4}
                value={staffPassword}
                onChange={(e) => setStaffPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
                autoComplete="new-password"
                placeholder="Used for admin + pickup board unlock"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">
                Restaurant name
              </span>
              <input
                required
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
                placeholder="My Restaurant"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">URL slug</span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
                placeholder="myrestaurant"
              />
              <span className="mt-1 block text-xs text-ink-soft/45">
                https://app.qiktik.tech/r/{slug || "…"}
              </span>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">Package</span>
              <select
                value={packageId}
                onChange={(e) => setPackageId(e.target.value as PackageId)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-[#1a211c] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
              >
                {PACKAGES.map((p) => (
                  <option
                    key={p.id}
                    value={p.id}
                    style={{ backgroundColor: "#ffffff", color: "#111111" }}
                  >
                    {p.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="border-t border-white/8 pt-4">
              <p className="text-xs font-semibold text-ink-soft">Branding</p>
              <label className="mt-3 block">
                <span className="text-xs text-ink-soft/70">Logo</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="mt-1.5 block w-full text-sm text-ink-soft file:me-3 file:rounded-lg file:border-0 file:bg-brass/20 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brass"
                  onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <ColorField
                  label="Accent"
                  value={accentColor}
                  onChange={setAccentColor}
                />
                <ColorField
                  label="Background"
                  value={backgroundColor}
                  onChange={setBackgroundColor}
                />
                <ColorField
                  label="Surface"
                  value={surfaceColor}
                  onChange={setSurfaceColor}
                />
                <ColorField label="Text" value={textColor} onChange={setTextColor} />
              </div>

              <div
                className="mt-4 overflow-hidden rounded-xl border border-white/10"
                style={{ background: backgroundColor, color: textColor }}
              >
                <div
                  className="flex items-center gap-3 border-b border-white/10 px-3 py-3"
                  style={{ background: surfaceColor }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={logoPreview}
                    alt=""
                    width={40}
                    height={40}
                    className="h-10 w-10 rounded-full object-cover"
                    style={{ border: `2px solid ${accentColor}` }}
                  />
                  <div className="min-w-0">
                    <p
                      className="text-[10px] font-bold uppercase tracking-[0.18em]"
                      style={{ color: accentColor }}
                    >
                      Guest home
                    </p>
                    <p className="truncate text-sm font-semibold">
                      {name || "Restaurant name"}
                    </p>
                  </div>
                </div>
                <p className="px-3 py-2 text-xs opacity-70">Preview of guest header</p>
              </div>
            </div>

            {error ? (
              <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full px-4 py-3 text-sm font-bold disabled:opacity-55"
            >
              {busy ? "Creating…" : "Create venue"}
            </button>
          </form>

          {created ? (
            <div className="guest-panel mt-6 space-y-3 rounded-2xl p-5">
              <p className="font-semibold text-ink">Created {created.name}</p>
              {venueLinkLabelsForPackage(packageId).map(({ key, label }) => {
                const href = created.urls?.[key];
                if (!href) return null;
                return (
                  <div
                    key={key}
                    className="flex flex-wrap items-start justify-between gap-2 border-t border-white/8 pt-3 first:border-t-0 first:pt-0"
                  >
                    <a
                      href={href}
                      className="min-w-0 flex-1 break-all text-sm text-brass hover:underline"
                    >
                      <span className="text-ink-soft/55">{label}: </span>
                      {href}
                    </a>
                    <LinkQrActions
                      href={href}
                      label={`${created.name} · ${label}`}
                      compact
                    />
                  </div>
                );
              })}
              <p className="border-t border-white/8 pt-3 text-sm">
                <Link href="/platform" className="font-semibold text-brass hover:underline">
                  Back to restaurants
                </Link>
              </p>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs text-ink-soft/70">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-10 cursor-pointer rounded-lg border border-white/10 bg-transparent p-0.5"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-2 font-mono text-xs text-[#f2efe8] outline-none focus:border-brass/40"
          pattern="^#[0-9A-Fa-f]{6}$"
        />
      </div>
    </label>
  );
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
