"use client";

import type { ReactNode } from "react";
import {
  externalHref,
  phoneTelHref,
  socialProfileHref,
  type VenueBrand,
} from "@/lib/venue-brand";
import { useVenueBrand } from "@/components/VenueThemeProvider";

type Props = {
  /** Override brand (e.g. from SSR); defaults to VenueThemeProvider */
  brand?: VenueBrand | null;
  className?: string;
};

type ContactLink = {
  key: string;
  href: string;
  label: string;
  icon: ReactNode;
};

/**
 * Guest contact icons — only renders entries configured in branding.
 */
export function VenueContactIcons({ brand: brandProp, className = "" }: Props) {
  const themeBrand = useVenueBrand();
  const brand = brandProp ?? themeBrand;

  const links: ContactLink[] = [];

  const phone = brand.phone?.trim() || "";
  const tel = phoneTelHref(phone);
  if (tel) {
    links.push({
      key: "phone",
      href: tel,
      label: phone,
      icon: <PhoneIcon />,
    });
  }

  const waze = externalHref(brand.wazeUrl);
  if (waze) {
    links.push({
      key: "waze",
      href: waze,
      label: "Waze",
      icon: <WazeIcon />,
    });
  }

  const instagram = socialProfileHref(
    brand.instagramUrl,
    "https://www.instagram.com"
  );
  if (instagram) {
    links.push({
      key: "instagram",
      href: instagram,
      label: "Instagram",
      icon: <InstagramIcon />,
    });
  }

  const facebook = socialProfileHref(
    brand.facebookUrl,
    "https://www.facebook.com"
  );
  if (facebook) {
    links.push({
      key: "facebook",
      href: facebook,
      label: "Facebook",
      icon: <FacebookIcon />,
    });
  }

  const tiktok = socialProfileHref(
    brand.tiktokUrl,
    "https://www.tiktok.com",
    "@"
  );
  if (tiktok) {
    links.push({
      key: "tiktok",
      href: tiktok,
      label: "TikTok",
      icon: <TikTokIcon />,
    });
  }

  const google = externalHref(brand.googleUrl);
  if (google) {
    links.push({
      key: "google",
      href: google,
      label: "Google",
      icon: <GoogleIcon />,
    });
  }

  if (links.length === 0) return null;

  return (
    <div
      className={`inline-flex items-center justify-center rounded-full border border-white/20 bg-black/35 px-1 py-0.5 backdrop-blur-sm ${className}`}
    >
      {links.map((link, i) => (
        <div key={link.key} className="flex items-center">
          {i > 0 ? (
            <span
              aria-hidden
              className="mx-0.5 h-3.5 w-px shrink-0 bg-white/30"
            />
          ) : null}
          <a
            href={link.href}
            target={link.key === "phone" ? undefined : "_blank"}
            rel={link.key === "phone" ? undefined : "noopener noreferrer"}
            aria-label={link.label}
            title={link.label}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-white/10"
          >
            {link.icon}
            <span className="sr-only">{link.label}</span>
          </a>
        </div>
      ))}
    </div>
  );
}

function PhoneIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M6.62 10.79a15.05 15.05 0 0 0 6.59 6.59l2.2-2.2a1 1 0 0 1 1.01-.24c1.12.37 2.33.57 3.58.57a1 1 0 0 1 1 1V20a1 1 0 0 1-1 1C10.4 21 3 13.6 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.46.57 3.58a1 1 0 0 1-.25 1.02l-2.2 2.19Z"
        fill="#E4C57A"
      />
    </svg>
  );
}

/** Official Waze outline mark (Simple Icons) */
function WazeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#33CCFF"
        fillRule="evenodd"
        d="M13.218 0C9.915 0 6.835 1.49 4.723 4.148c-1.515 1.913-2.31 4.272-2.31 6.706v1.739c0 .894-.62 1.738-1.862 1.813-.298.025-.547.224-.547.522-.05.82.82 2.31 2.012 3.502.82.844 1.788 1.515 2.832 2.036a3 3 0 0 0 2.955 3.528 2.966 2.966 0 0 0 2.931-2.385h2.509c.323 1.689 2.086 2.856 3.974 2.21 1.64-.546 2.36-2.409 1.763-3.924a12.84 12.84 0 0 0 1.838-1.465 10.73 10.73 0 0 0 3.18-7.65c0-2.882-1.118-5.589-3.155-7.625A10.899 10.899 0 0 0 13.218 0zm0 1.217c2.558 0 4.967.994 6.78 2.807a9.525 9.525 0 0 1 2.807 6.78A9.526 9.526 0 0 1 20 17.585a9.647 9.647 0 0 1-6.78 2.807h-2.46a3.008 3.008 0 0 0-2.93-2.41 3.03 3.03 0 0 0-2.534 1.367v.024a8.945 8.945 0 0 1-2.41-1.788c-.844-.844-1.316-1.614-1.515-2.11a2.858 2.858 0 0 0 1.441-.846 2.959 2.959 0 0 0 .795-2.036v-1.789c0-2.11.696-4.197 2.012-5.861 1.863-2.385 4.62-3.726 7.6-3.726zm-2.41 5.986a1.192 1.192 0 0 0-1.191 1.192 1.192 1.192 0 0 0 1.192 1.193A1.192 1.192 0 0 0 12 8.395a1.192 1.192 0 0 0-1.192-1.192zm7.204 0a1.192 1.192 0 0 0-1.192 1.192 1.192 1.192 0 0 0 1.192 1.193 1.192 1.192 0 0 0 1.192-1.193 1.192 1.192 0 0 0-1.192-1.192zm-7.377 4.769a.596.596 0 0 0-.546.845 4.813 4.813 0 0 0 4.346 2.757 4.77 4.77 0 0 0 4.347-2.757.596.596 0 0 0-.547-.845h-.025a.561.561 0 0 0-.521.348 3.59 3.59 0 0 1-3.254 2.061 3.591 3.591 0 0 1-3.254-2.061.64.64 0 0 0-.546-.348z"
      />
    </svg>
  );
}

/** Instagram glyph with brand gradient */
function InstagramIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <radialGradient id="qiktik-ig-grad" cx="30%" cy="107%" r="150%">
          <stop offset="0%" stopColor="#fdf497" />
          <stop offset="5%" stopColor="#fdf497" />
          <stop offset="45%" stopColor="#fd5949" />
          <stop offset="60%" stopColor="#d6249f" />
          <stop offset="90%" stopColor="#285AEB" />
        </radialGradient>
      </defs>
      <path
        fill="url(#qiktik-ig-grad)"
        d="M12 2.16c3.2 0 3.58.01 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.15 3.23-1.66 4.77-4.92 4.92-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-3.26-.15-4.77-1.7-4.92-4.92-.06-1.27-.07-1.65-.07-4.85s.01-3.58.07-4.85C2.38 3.92 3.9 2.38 7.15 2.23 8.42 2.17 8.8 2.16 12 2.16Zm0 1.8c-3.15 0-3.52.01-4.76.07-2.25.1-3.4 1.24-3.5 3.5-.06 1.24-.07 1.61-.07 4.76s.01 3.52.07 4.76c.1 2.25 1.25 3.4 3.5 3.5 1.24.06 1.61.07 4.76.07s3.52-.01 4.76-.07c2.25-.1 3.4-1.26 3.5-3.5.06-1.24.07-1.61.07-4.76s-.01-3.52-.07-4.76c-.1-2.25-1.26-3.4-3.5-3.5-1.24-.06-1.61-.07-4.76-.07Zm0 3.06a5.18 5.18 0 1 1 0 10.36 5.18 5.18 0 0 1 0-10.36Zm0 8.55a3.37 3.37 0 1 0 0-6.74 3.37 3.37 0 0 0 0 6.74Zm5.34-9.8a1.21 1.21 0 1 1-2.42 0 1.21 1.21 0 0 1 2.42 0Z"
      />
    </svg>
  );
}

/** Facebook "f" mark */
function FacebookIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.42 18.63 0 12 0S0 5.42 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.79-4.7 4.53-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.89v2.26h3.32l-.53 3.49h-2.79V24C19.62 23.1 24 18.1 24 12.07Z"
      />
    </svg>
  );
}

/** TikTok note mark */
function TikTokIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#25F4EE"
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.76 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.83.12v-3.5A6.32 6.32 0 0 0 9.15 9.2 6.34 6.34 0 0 0 2.8 15.54 6.34 6.34 0 0 0 9.15 21.9a6.34 6.34 0 0 0 6.34-6.36V8.7a8.18 8.18 0 0 0 4.76 1.52V6.8c-.34-.02-.68-.05-1-.11Z"
        transform="translate(0.6 0.4)"
      />
      <path
        fill="#FE2C55"
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.76 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.83.12v-3.5A6.32 6.32 0 0 0 9.15 9.2 6.34 6.34 0 0 0 2.8 15.54 6.34 6.34 0 0 0 9.15 21.9a6.34 6.34 0 0 0 6.34-6.36V8.7a8.18 8.18 0 0 0 4.76 1.52V6.8c-.34-.02-.68-.05-1-.11Z"
        transform="translate(-0.6 -0.4)"
      />
      <path
        fill="#fff"
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.76 2.89 2.89 0 0 1-2.88-2.88 2.89 2.89 0 0 1 2.88-2.88c.28 0 .56.04.83.12v-3.5A6.32 6.32 0 0 0 9.15 9.2 6.34 6.34 0 0 0 2.8 15.54 6.34 6.34 0 0 0 9.15 21.9a6.34 6.34 0 0 0 6.34-6.36V8.7a8.18 8.18 0 0 0 4.76 1.52V6.8c-.34-.02-.68-.05-1-.11Z"
      />
    </svg>
  );
}

/** Google "G" mark (Maps / Business) */
function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53Z"
      />
    </svg>
  );
}
