"use client";

import { QikTikLogo } from "@/components/QikTikLogo";

type Props = {
  title: string;
  body: string;
  adminLabel?: string;
};

/** Staff-facing empty state when a package feature is off. */
export function FeatureDisabled({ title, body, adminLabel = "Admin" }: Props) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-5">
      <QikTikLogo className="absolute end-4 top-4" />
      <div className="guest-panel w-full max-w-md rounded-2xl p-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm text-ink-soft/70">{body}</p>
        <a
          href="/admin"
          className="mt-6 inline-block rounded-xl bg-brass px-4 py-2.5 text-sm font-semibold text-[#0c100e]"
        >
          {adminLabel}
        </a>
      </div>
    </div>
  );
}
