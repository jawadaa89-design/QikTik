"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { TABLE_LOCK_MS } from "@/lib/table-lock";
import { clearLanguagePick } from "@/lib/guest-lang";
import { useLiveEvents } from "@/hooks/useLiveEvents";

type AuthState = {
  sessionId: string;
  guestName: string;
  unlockedAt: number;
};

type GuestAuthContextType = {
  ready: boolean;
  needsRegistration: boolean;
  needsUnlock: boolean;
  locked: boolean;
  guestName: string | null;
  tableNumber: number | null;
  sessionId: string | null;
  lockMs: number;
  refreshStatus: () => Promise<void>;
  register: (input: {
    name: string;
    phone: string;
    password: string;
    locale: string;
    acceptTerms: true;
    marketingOptIn?: boolean;
  }) => Promise<string | null>;
  unlock: (password: string) => Promise<string | null>;
  /** Returns true if unlocked; if locked, opens unlock UI and returns false */
  ensureUnlocked: () => boolean;
  requestUnlock: () => void;
  clearLocalAuth: () => void;
  markUnlocked: (sessionId: string, guestName: string) => void;
  showUnlockPrompt: boolean;
  setShowUnlockPrompt: (v: boolean) => void;
};

const GuestAuthContext = createContext<GuestAuthContextType | null>(null);

function storageKey(token: string) {
  return `qiktik-guest-auth:${token}`;
}

function loadLocal(token: string): AuthState | null {
  try {
    const raw = sessionStorage.getItem(storageKey(token));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthState;
    if (!parsed?.sessionId || !parsed.unlockedAt) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveLocal(token: string, state: AuthState | null) {
  try {
    if (!state) sessionStorage.removeItem(storageKey(token));
    else sessionStorage.setItem(storageKey(token), JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

async function readJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function errorMessage(data: Record<string, unknown>, fallback: string) {
  const err = data.error as { message?: string } | undefined;
  return err?.message || fallback;
}

export function GuestAuthProvider({
  token,
  children,
}: {
  token: string;
  children: ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const [needsRegistration, setNeedsRegistration] = useState(true);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [guestName, setGuestName] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState<number | null>(null);
  const [unlockedAt, setUnlockedAt] = useState<number | null>(null);
  const [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const locked = useMemo(() => {
    if (!sessionId || !unlockedAt) return true;
    return Date.now() - unlockedAt > TABLE_LOCK_MS;
  }, [sessionId, unlockedAt, now]);

  // tick so lock expires without user action
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(t);
  }, []);

  const markUnlocked = useCallback(
    (sid: string, name: string) => {
      const at = Date.now();
      setSessionId(sid);
      setGuestName(name);
      setUnlockedAt(at);
      setNeedsRegistration(false);
      setNeedsUnlock(false);
      setShowUnlockPrompt(false);
      saveLocal(token, { sessionId: sid, guestName: name, unlockedAt: at });
    },
    [token]
  );

  const clearLocalAuth = useCallback(() => {
    setUnlockedAt(null);
    setSessionId(null);
    setGuestName(null);
    saveLocal(token, null);
    clearLanguagePick(token);
  }, [token]);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/tables/${token}/auth`);
      if (!res.ok) {
        setReady(true);
        return;
      }
      const data = await readJson(res);
      setTableNumber((data.tableNumber as number) ?? null);

      if (data.needsRegistration) {
        setNeedsRegistration(true);
        setNeedsUnlock(false);
        setShowUnlockPrompt(false);
        setSessionId((data.sessionId as string) ?? null);
        setGuestName((data.guestName as string) ?? null);
        setUnlockedAt(null);
        saveLocal(token, null);
        setReady(true);
        return;
      }

      setNeedsRegistration(false);
      setNeedsUnlock(true);
      setSessionId(data.sessionId as string);
      setGuestName((data.guestName as string) ?? null);

      const local = loadLocal(token);
      if (local && local.sessionId === data.sessionId) {
        setUnlockedAt(local.unlockedAt);
        setGuestName(local.guestName || (data.guestName as string) || null);
        // if already expired, keep locked
        if (Date.now() - local.unlockedAt > TABLE_LOCK_MS) {
          setShowUnlockPrompt(false);
        }
      } else {
        setUnlockedAt(null);
        saveLocal(token, null);
      }
    } catch {
      /* network blip */
    } finally {
      setReady(true);
    }
  }, [token]);

  useEffect(() => {
    refreshStatus();
    // Re-check when waiter pays/closes — guest must register again
    const timer = setInterval(() => {
      void refreshStatus();
    }, 20_000);
    return () => clearInterval(timer);
  }, [refreshStatus]);

  useLiveEvents((event) => {
    if (event === "session:updated" || event === "payment:completed") {
      void refreshStatus();
    }
  });

  const register = useCallback(
    async (input: {
      name: string;
      phone: string;
      password: string;
      locale: string;
      acceptTerms: true;
      marketingOptIn?: boolean;
    }) => {
      try {
        const res = await fetch(`/api/v1/tables/${token}/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await readJson(res);

        // Table already has a guest — switch to unlock instead of failing hard
        if (res.status === 409) {
          await refreshStatus();
          setShowUnlockPrompt(true);
          return null;
        }

        if (!res.ok) {
          return errorMessage(data, "Registration failed");
        }

        const sid = data.sessionId as string | undefined;
        const name = (data.guestName as string) || input.name;
        if (!sid) {
          await refreshStatus();
          return "Registration failed — try again";
        }
        markUnlocked(sid, name);
        return null;
      } catch {
        return "Network error — try again";
      }
    },
    [token, markUnlocked, refreshStatus]
  );

  const unlock = useCallback(
    async (password: string) => {
      try {
        const res = await fetch(`/api/v1/tables/${token}/auth/unlock`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        const data = await readJson(res);
        if (!res.ok) return errorMessage(data, "Wrong password");
        const sid = data.sessionId as string | undefined;
        const name = (data.guestName as string) || guestName || "Guest";
        if (!sid) return "Unlock failed — try again";
        markUnlocked(sid, name);
        return null;
      } catch {
        return "Network error — try again";
      }
    },
    [token, markUnlocked, guestName]
  );

  const ensureUnlocked = useCallback(() => {
    if (!needsRegistration && sessionId && unlockedAt && Date.now() - unlockedAt <= TABLE_LOCK_MS) {
      return true;
    }
    setShowUnlockPrompt(true);
    return false;
  }, [needsRegistration, sessionId, unlockedAt]);

  const requestUnlock = useCallback(() => setShowUnlockPrompt(true), []);

  const value: GuestAuthContextType = {
    ready,
    needsRegistration,
    needsUnlock,
    locked: needsRegistration || locked,
    guestName,
    tableNumber,
    sessionId,
    lockMs: TABLE_LOCK_MS,
    refreshStatus,
    register,
    unlock,
    ensureUnlocked,
    requestUnlock,
    clearLocalAuth,
    markUnlocked,
    showUnlockPrompt,
    setShowUnlockPrompt,
  };

  return (
    <GuestAuthContext.Provider value={value}>{children}</GuestAuthContext.Provider>
  );
}

export function useGuestAuth() {
  const ctx = useContext(GuestAuthContext);
  if (!ctx) throw new Error("useGuestAuth must be used within GuestAuthProvider");
  return ctx;
}
