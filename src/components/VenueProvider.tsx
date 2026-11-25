"use client";

import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { normalizeVenueSlug } from "@/lib/venue-paths";
import {
  ensureStaffApiFetchPatch,
  setActiveVenueSlug,
} from "@/lib/staff-client";

type VenueContextValue = {
  venueSlug: string;
  venueName: string;
};

const VenueContext = createContext<VenueContextValue | null>(null);

function slugFromPathname(pathname: string | null): string | null {
  if (!pathname) return null;
  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "r" && parts[1]) return parts[1].toLowerCase();
  return null;
}

export function VenueProvider({
  children,
  venueSlug: venueSlugProp,
  venueName: venueNameProp,
}: {
  children: ReactNode;
  venueSlug?: string;
  venueName?: string;
}) {
  const pathname = usePathname();
  // usePathname is the rewritten path (/admin); browser URL keeps /r/{slug}/…
  const [browserSlug, setBrowserSlug] = useState<string | null>(null);

  useLayoutEffect(() => {
    try {
      setBrowserSlug(slugFromPathname(window.location.pathname));
    } catch {
      setBrowserSlug(null);
    }
  }, [pathname]);

  const venueSlug = useMemo(
    () =>
      normalizeVenueSlug(
        browserSlug ||
          venueSlugProp ||
          slugFromPathname(pathname) ||
          DEFAULT_VENUE_SLUG
      ),
    [browserSlug, venueSlugProp, pathname]
  );
  const venueName = (venueNameProp?.trim() || "Restaurant").trim();

  useLayoutEffect(() => {
    ensureStaffApiFetchPatch();
    setActiveVenueSlug(venueSlug);
    return () => {
      setActiveVenueSlug(null);
    };
  }, [venueSlug]);

  const value = useMemo(
    () => ({ venueSlug, venueName }),
    [venueSlug, venueName]
  );

  return (
    <VenueContext.Provider value={value}>{children}</VenueContext.Provider>
  );
}

export function useVenueSlug(): string {
  const ctx = useContext(VenueContext);
  const pathname = usePathname();
  if (ctx?.venueSlug) return ctx.venueSlug;
  if (typeof window !== "undefined") {
    const fromBrowser = slugFromPathname(window.location.pathname);
    if (fromBrowser) return normalizeVenueSlug(fromBrowser);
  }
  return normalizeVenueSlug(slugFromPathname(pathname) || DEFAULT_VENUE_SLUG);
}

/** Display name for the active restaurant (from DB via layout). */
export function useVenueName(): string {
  const ctx = useContext(VenueContext);
  return ctx?.venueName?.trim() || "Restaurant";
}
