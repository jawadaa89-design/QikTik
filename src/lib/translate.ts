import { locales, type Locale } from "@/i18n/config";

type ItemTranslation = { name: string; description?: string | null };
type CategoryTranslation = { name: string };

function translationDisabled() {
  return process.env.AUTO_TRANSLATE === "false";
}

/** Google Translate public endpoint (no API key). */
async function translateViaGoogle(
  text: string,
  from: Locale,
  to: Locale
): Promise<string | null> {
  try {
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", from);
    url.searchParams.set("tl", to);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);

    const res = await fetch(url.toString(), { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as unknown;
    if (!Array.isArray(data) || !Array.isArray(data[0])) return null;
    const out = (data[0] as unknown[])
      .map((part) => (Array.isArray(part) ? String(part[0] ?? "") : ""))
      .join("")
      .trim();
    return out || null;
  } catch {
    return null;
  }
}

/** MyMemory free translate (fallback). */
async function translateViaMyMemory(
  text: string,
  from: Locale,
  to: Locale
): Promise<string | null> {
  try {
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.set("q", text.slice(0, 450));
    url.searchParams.set("langpair", `${from}|${to}`);
    const email = process.env.MYMEMORY_EMAIL?.trim();
    if (email) url.searchParams.set("de", email);

    const res = await fetch(url.toString(), {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      responseData?: { translatedText?: string };
      responseStatus?: number;
    };
    const out = data.responseData?.translatedText?.trim();
    if (!out || data.responseStatus !== 200) return null;
    if (/QUERY LENGTH|INVALID|ERROR/i.test(out)) return null;
    return out;
  } catch {
    return null;
  }
}

async function translateText(
  text: string,
  from: Locale,
  to: Locale
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed || from === to) return trimmed;

  const viaGoogle = await translateViaGoogle(trimmed, from, to);
  if (viaGoogle) return viaGoogle;

  const viaMemory = await translateViaMyMemory(trimmed, from, to);
  if (viaMemory) return viaMemory;

  console.warn(`[translate] failed ${from}→${to} for: ${trimmed.slice(0, 40)}`);
  return trimmed;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

function pickSourceLocale(partial: Record<string, { name?: string | null }>): Locale {
  for (const loc of locales) {
    if (partial[loc]?.name?.trim()) return loc;
  }
  const first = Object.keys(partial).find((k) => partial[k]?.name?.trim());
  return (first as Locale) || locales[0];
}

/**
 * Expand partial item translations to all app locales.
 * Existing non-empty target values are kept; missing ones are auto-translated.
 */
export async function expandItemTranslations(
  partial: Record<string, ItemTranslation>
): Promise<Record<Locale, ItemTranslation>> {
  const entries = Object.entries(partial).filter(([, t]) => t.name?.trim());
  if (entries.length === 0) {
    throw new Error("At least one translation with a name is required");
  }

  const sourceLocale = pickSourceLocale(partial);
  const source = {
    name: partial[sourceLocale]!.name.trim(),
    description: partial[sourceLocale]!.description?.trim() || "",
  };

  const result = {} as Record<Locale, ItemTranslation>;
  for (const [loc, t] of entries) {
    result[loc as Locale] = {
      name: t.name.trim(),
      description: t.description?.trim() || "",
    };
  }

  if (translationDisabled()) {
    for (const loc of locales) {
      if (!result[loc]) {
        result[loc] = { name: source.name, description: source.description };
      }
    }
    return result;
  }

  const missing = locales.filter((loc) => !result[loc]?.name?.trim());
  const filled = await mapWithConcurrency(missing, 2, async (loc) => {
    const name = await translateText(source.name, sourceLocale, loc);
    const description = source.description
      ? await translateText(source.description, sourceLocale, loc)
      : "";
    return [loc, { name, description }] as const;
  });

  for (const [loc, t] of filled) {
    result[loc] = t;
  }

  for (const loc of locales) {
    if (!result[loc]) {
      result[loc] = { name: source.name, description: source.description };
    }
  }

  return result;
}

/** Expand category name translations to all locales (ar / he / en / ru). */
export async function expandCategoryTranslations(
  partial: Record<string, CategoryTranslation>
): Promise<Record<Locale, CategoryTranslation>> {
  const entries = Object.entries(partial).filter(([, t]) => t.name?.trim());
  if (entries.length === 0) {
    throw new Error("At least one category name is required");
  }

  const sourceLocale = pickSourceLocale(partial);
  const sourceName = partial[sourceLocale]!.name.trim();
  const result = {} as Record<Locale, CategoryTranslation>;
  for (const [loc, t] of entries) {
    result[loc as Locale] = { name: t.name.trim() };
  }

  if (translationDisabled()) {
    for (const loc of locales) {
      if (!result[loc]) result[loc] = { name: sourceName };
    }
    return result;
  }

  const missing = locales.filter((loc) => !result[loc]?.name?.trim());
  const filled = await mapWithConcurrency(missing, 2, async (loc) => {
    const name = await translateText(sourceName, sourceLocale, loc);
    return [loc, { name }] as const;
  });

  for (const [loc, t] of filled) {
    result[loc] = t;
  }

  for (const loc of locales) {
    if (!result[loc]) result[loc] = { name: sourceName };
  }

  return result;
}

/**
 * For PATCH item: apply incoming edits as-is.
 * Auto-translate ONLY into locales that are still missing.
 */
export async function fillMissingItemTranslations(
  existing: Record<string, ItemTranslation>,
  incoming: Record<string, ItemTranslation>
): Promise<{
  upserts: Record<string, ItemTranslation>;
  creates: Record<string, ItemTranslation>;
}> {
  const upserts: Record<string, ItemTranslation> = {};
  for (const [loc, t] of Object.entries(incoming)) {
    if (!t.name?.trim()) continue;
    upserts[loc] = {
      name: t.name.trim(),
      description: t.description?.trim() || "",
    };
  }

  const present = new Set<string>([
    ...Object.keys(existing).filter((loc) => existing[loc]?.name?.trim()),
    ...Object.keys(upserts),
  ]);

  const missing = locales.filter((loc) => !present.has(loc));
  const creates: Record<string, ItemTranslation> = {};

  if (missing.length === 0 || translationDisabled()) {
    return { upserts, creates };
  }

  const sourceLocale = pickSourceLocale({ ...existing, ...upserts });
  const sourceRow = upserts[sourceLocale] ?? existing[sourceLocale];
  if (!sourceRow?.name?.trim()) return { upserts, creates };

  const source = {
    name: sourceRow.name.trim(),
    description: sourceRow.description?.trim() || "",
  };

  const filled = await mapWithConcurrency(missing, 2, async (loc) => {
    const name = await translateText(source.name, sourceLocale, loc);
    const description = source.description
      ? await translateText(source.description, sourceLocale, loc)
      : "";
    return [loc, { name, description }] as const;
  });

  for (const [loc, t] of filled) {
    creates[loc] = t;
  }

  return { upserts, creates };
}

/** Fill missing category locale names without overwriting existing ones. */
export async function fillMissingCategoryTranslations(
  existing: Record<string, CategoryTranslation>,
  incoming: Record<string, CategoryTranslation>
): Promise<{
  upserts: Record<string, CategoryTranslation>;
  creates: Record<string, CategoryTranslation>;
}> {
  const upserts: Record<string, CategoryTranslation> = {};
  for (const [loc, t] of Object.entries(incoming)) {
    if (!t.name?.trim()) continue;
    upserts[loc] = { name: t.name.trim() };
  }

  const present = new Set<string>([
    ...Object.keys(existing).filter((loc) => existing[loc]?.name?.trim()),
    ...Object.keys(upserts),
  ]);
  const missing = locales.filter((loc) => !present.has(loc));
  const creates: Record<string, CategoryTranslation> = {};

  if (missing.length === 0 || translationDisabled()) {
    return { upserts, creates };
  }

  const sourceLocale = pickSourceLocale({ ...existing, ...upserts });
  const sourceName = (upserts[sourceLocale] ?? existing[sourceLocale])?.name?.trim();
  if (!sourceName) return { upserts, creates };

  const filled = await mapWithConcurrency(missing, 2, async (loc) => {
    const name = await translateText(sourceName, sourceLocale, loc);
    return [loc, { name }] as const;
  });

  for (const [loc, t] of filled) {
    creates[loc] = t;
  }

  return { upserts, creates };
}
