/** Client-side staff session helpers (iPad Safari often drops httpOnly cookies on http://LAN-IP). */

import { VENUE_SLUG_HEADER } from "@/lib/venue-paths";

export const STAFF_TOKEN_STORAGE_KEY = "qiktik_staff_token";
export const STAFF_TOKEN_HEADER = "x-qiktik-staff";

/** In-memory fallback when storage is blocked. */
let memoryToken: string | null = null;

/**
 * Per-tab venue for API calls. Each Chrome tab has its own JS realm, so this
 * stays correct even when the shared qiktik_venue_slug cookie flips.
 */
let activeVenueSlug: string | null = null;
let fetchPatchInstalled = false;

/** Tell staff API fetch which /r/{slug} tab this document belongs to. */
export function setActiveVenueSlug(slug: string | null | undefined) {
  const next = slug?.trim().toLowerCase() || null;
  activeVenueSlug = next;
}

function attachVenueToRequest(
  input: RequestInfo | URL,
  init?: RequestInit
): { input: RequestInfo | URL; init: RequestInit | undefined } {
  const slug = activeVenueSlug;
  if (!slug || typeof window === "undefined") {
    return { input, init };
  }

  try {
    const resolved = new URL(
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url,
      window.location.origin
    );
    if (!resolved.pathname.startsWith("/api/")) {
      return { input, init };
    }

    if (
      !resolved.searchParams.has("venue") &&
      !resolved.searchParams.has("venueSlug")
    ) {
      resolved.searchParams.set("venue", slug);
    }

    const headers = new Headers(init?.headers);
    if (!headers.has(VENUE_SLUG_HEADER) && !headers.has("x-venue")) {
      headers.set(VENUE_SLUG_HEADER, slug);
    }

    return {
      input: resolved.toString(),
      init: { ...init, headers },
    };
  } catch {
    return { input, init };
  }
}

/**
 * Patch window.fetch once per tab: pin /api/* to this tab's venue + staff 401 → login.
 * Safe with React Strict Mode (idempotent).
 */
export function ensureStaffApiFetchPatch() {
  if (typeof window === "undefined" || fetchPatchInstalled) return;
  fetchPatchInstalled = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const pinned = attachVenueToRequest(input, init);
    const res = await originalFetch(pinned.input, pinned.init);
    maybeNotifyStaffAuthRequired(res);
    return res;
  };
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&") + "=([^;]*)")
  );
  return match ? decodeURIComponent(match[1]!) : null;
}

export function getStaffToken(): string | null {
  if (memoryToken) return memoryToken;
  try {
    const fromLocal = localStorage.getItem(STAFF_TOKEN_STORAGE_KEY);
    if (fromLocal) {
      memoryToken = fromLocal;
      return fromLocal;
    }
  } catch {
    /* ignore */
  }
  try {
    const fromSession = sessionStorage.getItem(STAFF_TOKEN_STORAGE_KEY);
    if (fromSession) {
      memoryToken = fromSession;
      return fromSession;
    }
  } catch {
    /* ignore */
  }
  const fromCookie = readCookie(STAFF_TOKEN_STORAGE_KEY);
  if (fromCookie) {
    memoryToken = fromCookie;
    return fromCookie;
  }
  return null;
}

export function setStaffToken(token: string) {
  memoryToken = token;
  try {
    localStorage.setItem(STAFF_TOKEN_STORAGE_KEY, token);
  } catch {
    /* private mode / quota */
  }
  try {
    sessionStorage.setItem(STAFF_TOKEN_STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
  // Non-httpOnly cookie so EventSource (SSE) + credentialed fetch work on iPad LAN.
  // Server also accepts this cookie name as a staff session.
  try {
    const maxAge = 12 * 60 * 60;
    document.cookie = `${STAFF_TOKEN_STORAGE_KEY}=${encodeURIComponent(token)}; path=/; max-age=${maxAge}; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

export function clearStaffToken() {
  memoryToken = null;
  try {
    localStorage.removeItem(STAFF_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    sessionStorage.removeItem(STAFF_TOKEN_STORAGE_KEY);
  } catch {
    /* ignore */
  }
  try {
    document.cookie = `${STAFF_TOKEN_STORAGE_KEY}=; path=/; max-age=0; SameSite=Lax`;
  } catch {
    /* ignore */
  }
}

/** Fired when an API returns STAFF_AUTH_REQUIRED — StaffAuthGate shows login. */
export const STAFF_AUTH_REQUIRED_EVENT = "qiktik:staff-auth-required";

export function notifyStaffAuthRequired() {
  clearStaffToken();
  try {
    sessionStorage.removeItem("qiktik_staff_gate_ok");
  } catch {
    /* ignore */
  }
  try {
    document.cookie = "qiktik_staff=; path=/; max-age=0; SameSite=Lax";
    document.cookie = "qiktik_staff_token=; path=/; max-age=0; SameSite=Lax";
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STAFF_AUTH_REQUIRED_EVENT));
  }
}

function maybeNotifyStaffAuthRequired(res: Response) {
  if (res.status !== 401) return;
  void res
    .clone()
    .json()
    .then((data: { error?: { code?: string } }) => {
      if (data?.error?.code === "STAFF_AUTH_REQUIRED") {
        notifyStaffAuthRequired();
      }
    })
    .catch(() => {
      /* not JSON */
    });
}

/** fetch() with credentials + staff token header + access_token query fallback. */
export function staffFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  ensureStaffApiFetchPatch();
  const headers = new Headers(init.headers);
  const token = getStaffToken();
  if (token) headers.set(STAFF_TOKEN_HEADER, token);

  let url: RequestInfo | URL = input;
  if (token && typeof window !== "undefined") {
    try {
      const resolved = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        window.location.origin
      );
      if (!resolved.searchParams.has("access_token")) {
        resolved.searchParams.set("access_token", token);
      }
      url = resolved.toString();
    } catch {
      /* keep original input */
    }
  }

  const pinned = attachVenueToRequest(url, {
    ...init,
    credentials: "same-origin",
    headers,
  });

  return fetch(pinned.input, pinned.init).then((res) => {
    maybeNotifyStaffAuthRequired(res);
    return res;
  });
}
