"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  brandCssVars,
  brandFromVenue,
  DEFAULT_VENUE_BRAND,
  venueHeroSrc,
  venueLogoSrc,
  type VenueBrand,
} from "@/lib/venue-brand";

type VenueThemeContextValue = {
  brand: VenueBrand;
  logoSrc: string;
  heroSrc: string;
};

const VenueThemeContext = createContext<VenueThemeContextValue>({
  brand: DEFAULT_VENUE_BRAND,
  logoSrc: "/logo.png",
  heroSrc: "/venue-hero-default.jpg?v=c4",
});

export function VenueThemeProvider({
  children,
  brand: brandProp,
}: {
  children: ReactNode;
  brand?: VenueBrand | null;
}) {
  const brand = brandProp ?? DEFAULT_VENUE_BRAND;
  const logoSrc = venueLogoSrc(brand);
  const heroSrc = venueHeroSrc(brand);
  const value = useMemo(
    () => ({ brand, logoSrc, heroSrc }),
    [brand, logoSrc, heroSrc]
  );

  useEffect(() => {
    const root = document.documentElement;
    const vars = brandCssVars(brand);
    for (const [key, val] of Object.entries(vars)) {
      root.style.setProperty(key, val);
    }
    return () => {
      for (const key of Object.keys(vars)) {
        root.style.removeProperty(key);
      }
    };
  }, [brand]);

  // Lock to the *visible* phone viewport so the guest home fits before any tap
  // (iOS/Android chrome can leave 100dvh wrong until interaction).
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => {
      const h =
        window.visualViewport?.height ??
        window.innerHeight ??
        root.clientHeight;
      if (h > 0) root.style.setProperty("--app-height", `${Math.round(h)}px`);
    };
    sync();
    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("scroll", sync);
    window.addEventListener("orientationchange", sync);
    // One more pass after paint / browser UI settle
    const t1 = window.setTimeout(sync, 50);
    const t2 = window.setTimeout(sync, 300);
    return () => {
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("scroll", sync);
      window.removeEventListener("orientationchange", sync);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      root.style.removeProperty("--app-height");
    };
  }, []);

  const style = brandCssVars(brand) as CSSProperties;

  return (
    <VenueThemeContext.Provider value={value}>
      <div className="venue-theme flex flex-col" style={style}>
        {children}
      </div>
    </VenueThemeContext.Provider>
  );
}

export function useVenueBrand(): VenueBrand {
  return useContext(VenueThemeContext).brand;
}

export function useVenueLogoSrc(): string {
  return useContext(VenueThemeContext).logoSrc;
}

/** Guest home atmosphere photo (venue upload or shared default). */
export function useVenueHeroSrc(): string {
  return useContext(VenueThemeContext).heroSrc;
}

/** Server-safe serialize for passing brand into client provider. */
export function serializeBrand(
  venue: Parameters<typeof brandFromVenue>[0]
): VenueBrand {
  return brandFromVenue(venue);
}
