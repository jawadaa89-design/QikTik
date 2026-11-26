"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { QikTikLogo } from "@/components/QikTikLogo";
import {
  clearPlatformPassword,
  setPlatformPassword,
} from "@/lib/platform-session";

type Mode = "change" | "reset";

export default function PlatformPasswordPage() {
  const [mode, setMode] = useState<Mode>("change");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [codeSent, setCodeSent] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setMsg(null);
    setCodeSent(false);
  }

  async function onChange(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (newPassword.trim().length < 4) {
      setError("New password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/platform/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message || "Could not change password");
        return;
      }
      setPlatformPassword(newPassword.trim());
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg("Platform password updated");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onSendCode() {
    setError(null);
    setMsg(null);
    setBusy(true);
    try {
      const res = await fetch("/api/v1/platform/password/reset", {
        method: "POST",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message || "Could not send code");
        return;
      }
      setCodeSent(true);
      setMsg(data?.message || "Reset code sent to the platform admin email");
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function onResetConfirm(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMsg(null);
    if (newPassword.trim().length < 4) {
      setError("New password must be at least 4 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/v1/platform/password/reset", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          newPassword,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error?.message || "Could not reset password");
        return;
      }
      clearPlatformPassword();
      setPlatformPassword(newPassword.trim());
      setCode("");
      setNewPassword("");
      setConfirmPassword("");
      setMsg("Password reset — you can unlock with the new password");
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
        Platform password
      </h1>
      <p className="mt-2 text-sm text-ink-soft/65">
        Change with the current password, or reset via a code emailed to the
        platform admin address.
      </p>
      <p className="mt-3 text-sm">
        <Link href="/platform" className="text-ink-soft/50 hover:text-brass">
          ← Back to restaurants
        </Link>
      </p>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => switchMode("change")}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
            mode === "change"
              ? "bg-brass text-[#0c100e]"
              : "border border-white/12 text-ink-soft/70"
          }`}
        >
          Change with current
        </button>
        <button
          type="button"
          onClick={() => switchMode("reset")}
          className={`rounded-xl px-3 py-1.5 text-xs font-semibold ${
            mode === "reset"
              ? "bg-brass text-[#0c100e]"
              : "border border-white/12 text-ink-soft/70"
          }`}
        >
          Reset via email code
        </button>
      </div>

      {mode === "change" ? (
        <form
          onSubmit={onChange}
          className="guest-panel mt-6 space-y-4 rounded-2xl p-5"
        >
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">
              Current password
            </span>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
              autoComplete="current-password"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">
              New password
            </span>
            <input
              type="password"
              required
              minLength={4}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
              autoComplete="new-password"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-ink-soft">
              Confirm new password
            </span>
            <input
              type="password"
              required
              minLength={4}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
              autoComplete="new-password"
            />
          </label>
          {error ? (
            <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
              {error}
            </p>
          ) : null}
          {msg ? (
            <p className="rounded-xl border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass">
              {msg}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={busy}
            className="btn-primary w-full px-4 py-3 text-sm font-bold disabled:opacity-55"
          >
            {busy ? "Saving…" : "Update password"}
          </button>
        </form>
      ) : (
        <div className="guest-panel mt-6 space-y-4 rounded-2xl p-5">
          <p className="text-sm text-ink-soft/65">
            We’ll email a 6-digit code to the configured platform admin address.
            Enter it below with your new password.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onSendCode()}
            className="w-full rounded-xl border border-brass/40 bg-brass/15 px-4 py-2.5 text-sm font-bold text-brass disabled:opacity-55"
          >
            {busy && !codeSent ? "Sending…" : codeSent ? "Resend code" : "Send email code"}
          </button>

          <form onSubmit={onResetConfirm} className="space-y-4 border-t border-white/8 pt-4">
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">
                Email code
              </span>
              <input
                required
                inputMode="numeric"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.replace(/[^\d]/g, "").slice(0, 6))
                }
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
                placeholder="6-digit code"
                autoComplete="one-time-code"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">
                New password
              </span>
              <input
                type="password"
                required
                minLength={4}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
                autoComplete="new-password"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-ink-soft">
                Confirm new password
              </span>
              <input
                type="password"
                required
                minLength={4}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[#f2efe8] outline-none focus:border-brass/40"
                autoComplete="new-password"
              />
            </label>
            {error ? (
              <p className="rounded-xl border border-alert/30 bg-alert/10 px-3 py-2 text-sm text-alert">
                {error}
              </p>
            ) : null}
            {msg ? (
              <p className="rounded-xl border border-brass/30 bg-brass/10 px-3 py-2 text-sm text-brass">
                {msg}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={busy}
              className="btn-primary w-full px-4 py-3 text-sm font-bold disabled:opacity-55"
            >
              {busy ? "Saving…" : "Reset password"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
