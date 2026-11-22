/** Client-side staff session helpers (iPad Safari often drops httpOnly cookies on http://LAN-IP). */

export const STAFF_TOKEN_STORAGE_KEY = "qiktik_staff_token";
export const STAFF_TOKEN_HEADER = "x-qiktik-staff";

/** In-memory fallback when storage is blocked. */
let memoryToken: string | null = null;

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

/** fetch() with credentials + staff token header + access_token query fallback. */
export function staffFetch(input: RequestInfo | URL, init: RequestInit = {}) {
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

  return fetch(url, {
    ...init,
    credentials: "same-origin",
    headers,
  });
}
