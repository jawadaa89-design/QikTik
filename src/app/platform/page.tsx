"use client";

import { FormEvent, useState } from "react";
import { QikTikLogo } from "@/components/QikTikLogo";
import type { PackageId } from "@/lib/features";

type Created = {
  name: string;
  slug: string;
  urls: { menu: string; admin: string; pickup: string };
};

const PACKAGES: { id: PackageId; label: string }[] = [
  { id: "menu_only", label: "Menu only" },
  { id: "menu_alerts", label: "Menu + alerts" },
  { id: "menu_alerts_pickup", label: "Menu + alerts + pickup" },
  { id: "menu_ordering", label: "Menu + ordering" },
];

export default function PlatformPage() {
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [packageId, setPackageId] = useState<PackageId>("menu_only");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);

  function onNameChange(value: string) {
    setName(value);
    if (!slug || slug === slugify(name)) {
      setSlug(slugify(value));
    }
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
        body: JSON.stringify({ name, slug, packageId, password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message || "Could not create venue");
        return;
      }
      setCreated(data.venue);
      setName("");
      setSlug("");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative mx-auto min-h-dvh max-w-lg px-4 py-10">
      <QikTikLogo className="absolute end-4 top-4" />
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brass">
        Platform
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-ink">
        Create restaurant
      </h1>
      <p className="mt-2 text-sm text-ink-soft/65">
        New venues are available at{" "}
        <code className="text-brass">/r/&#123;slug&#125;/…</code> on qiktik.tech.
      </p>

      <form
        onSubmit={onSubmit}
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
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
            autoComplete="off"
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
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
            placeholder="My Restaurant"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-soft">URL slug</span>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(slugify(e.target.value))}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
            placeholder="myrestaurant"
          />
          <span className="mt-1 block text-xs text-ink-soft/45">
            https://qiktik.tech/r/{slug || "…"}
          </span>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-ink-soft">Package</span>
          <select
            value={packageId}
            onChange={(e) => setPackageId(e.target.value as PackageId)}
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-ink outline-none focus:border-brass/40"
          >
            {PACKAGES.map((p) => (
              <option key={p.id} value={p.id} className="bg-[#161c19]">
                {p.label}
              </option>
            ))}
          </select>
        </label>

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
        <div className="guest-panel mt-6 space-y-2 rounded-2xl p-5">
          <p className="font-semibold text-ink">
            Created {created.name}
          </p>
          <a
            href={created.urls.menu}
            className="block break-all text-sm text-brass hover:underline"
          >
            {created.urls.menu}
          </a>
          <a
            href={created.urls.admin}
            className="block break-all text-sm text-brass hover:underline"
          >
            {created.urls.admin}
          </a>
        </div>
      ) : null}

      <p className="mt-8 text-center text-xs text-ink-soft/40">
        <a href="/r/myrestaurant/admin" className="hover:text-brass">
          Demo admin
        </a>
      </p>
    </div>
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
