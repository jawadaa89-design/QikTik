const KEY = "qiktik_platform_password";

/** Persist platform unlock for this browser tab (list ↔ create pages). */
export function getPlatformPassword(): string {
  try {
    return sessionStorage.getItem(KEY)?.trim() || "";
  } catch {
    return "";
  }
}

export function setPlatformPassword(password: string): void {
  try {
    sessionStorage.setItem(KEY, password);
  } catch {
    /* ignore */
  }
}

export function clearPlatformPassword(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
