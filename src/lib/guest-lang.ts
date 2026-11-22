const PREFIX = "qiktik-lang-picked:";
const LOCALE_PREFIX = "qiktik-lang-locale:";

function keyFor(token: string, sessionId?: string | null) {
  return sessionId ? `${PREFIX}${token}:${sessionId}` : `${PREFIX}${token}:new`;
}

export function clearLanguagePick(token: string) {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(`${PREFIX}${token}`)) sessionStorage.removeItem(k);
      if (k === `${LOCALE_PREFIX}${token}`) sessionStorage.removeItem(k);
    }
  } catch {
    /* ignore */
  }
}

export function getLanguagePicked(
  token: string,
  sessionId?: string | null
): boolean {
  try {
    return sessionStorage.getItem(keyFor(token, sessionId)) === "1";
  } catch {
    return false;
  }
}

export function setLanguagePicked(
  token: string,
  sessionId?: string | null
) {
  try {
    sessionStorage.setItem(keyFor(token, sessionId), "1");
  } catch {
    /* ignore */
  }
}

export function getChosenLanguage(token: string): string | null {
  try {
    return sessionStorage.getItem(`${LOCALE_PREFIX}${token}`);
  } catch {
    return null;
  }
}

export function setChosenLanguage(token: string, locale: string) {
  try {
    sessionStorage.setItem(`${LOCALE_PREFIX}${token}`, locale);
  } catch {
    /* ignore */
  }
}
