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

  // Lock to the visible phone viewport so guest home fits before any tap
  // (iOS/Android chrome can leave 100dvh wrong until interaction).
  // Do NOT shrink while a text field is focused — the keyboard collapses
  // visualViewport and was crushing register / form pages mid-typing.
  useEffect(() => {
    const root = document.documentElement;
    let blurTimer = 0;

    const isEditingText = () => {
      const el = document.activeElement;
      if (!el || !(el instanceof HTMLElement)) return false;
      if (el.isContentEditable) return true;
      const tag = el.tagName;
      if (tag === "TEXTAREA") return true;
      if (tag === "INPUT") {
        const type = (el as HTMLInputElement).type;
        return (
          type === "" ||
          type === "text" ||
          type === "search" ||
          type === "email" ||
          type === "tel" ||
          type === "url" ||
          type === "password" ||
          type === "number"
        );
      }
      return false;
    };

    const sync = (opts?: { force?: boolean }) => {
      const h =
        window.visualViewport?.height ??
        window.innerHeight ??
        root.clientHeight;
      if (!(h > 0)) return;

      if (!opts?.force) {
        if (isEditingText()) return;
        // Keyboard sometimes resizes before focus settles — ignore big shrinks
        const prev =
          parseFloat(root.style.getPropertyValue("--app-height")) || 0;
        if (prev > 0 && prev - h > 120) return;
      }

      root.style.setProperty("--app-height", `${Math.round(h)}px`);
    };

    const onFocusIn = () => {
      window.clearTimeout(blurTimer);
    };
    const onFocusOut = () => {
      window.clearTimeout(blurTimer);
      // After keyboard dismisses, remeasure once the viewport settles
      blurTimer = window.setTimeout(() => sync({ force: true }), 280);
    };

    const onOrientation = () => sync({ force: true });
    const onViewportResize = () => sync();

    sync();
    window.addEventListener("resize", onViewportResize);
    window.visualViewport?.addEventListener("resize", onViewportResize);
    window.addEventListener("orientationchange", onOrientation);
    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    const t1 = window.setTimeout(() => sync(), 50);
    const t2 = window.setTimeout(() => sync(), 300);
    return () => {
      window.removeEventListener("resize", onViewportResize);
      window.visualViewport?.removeEventListener("resize", onViewportResize);
      window.removeEventListener("orientationchange", onOrientation);
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(blurTimer);
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
