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

  if (links.length === 0) return null;

  return (
    <div
      className={`mt-3 flex flex-wrap items-center justify-center gap-2 ${className}`}
    >
      {links.map((link) => (
        <a
          key={link.key}
          href={link.href}
          target={link.key === "phone" ? undefined : "_blank"}
          rel={link.key === "phone" ? undefined : "noopener noreferrer"}
          aria-label={link.label}
          title={link.label}
          className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-brass/35 bg-brass/10 text-brass transition hover:border-brass/60 hover:bg-brass/20"
        >
          {link.icon}
          <span className="sr-only">{link.label}</span>
        </a>
      ))}
    </div>
  );
}

const iconProps = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none" as const,
  "aria-hidden": true as const,
};

function PhoneIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M6.6 3.7c.4-.4 1-.5 1.5-.3l2.2 1c.5.2.8.7.8 1.2v2.2c0 .4-.2.8-.6 1-.7.5-1 1.3-.8 2.1.5 2 2.1 3.6 4.1 4.1.8.2 1.6-.1 2.1-.8.2-.4.6-.6 1-.6h2.2c.5 0 1 .3 1.2.8l1 2.2c.2.5.1 1.1-.3 1.5-1.3 1.3-3.2 1.9-5.1 1.5C9.4 18.6 5.4 14.6 4.2 9.3c-.4-1.9.2-3.8 1.5-5.1Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WazeIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M12 3.5c-4.4 0-8 3.1-8 7.2 0 2.6 1.4 4.9 3.6 6.3v2.1c0 .5.5.8 1 .6l2.3-1.1c.4.1.7.1 1.1.1 4.4 0 8-3.1 8-7.2S16.4 3.5 12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <circle cx="9.2" cy="10.2" r="1.1" fill="currentColor" />
      <circle cx="14.8" cy="10.2" r="1.1" fill="currentColor" />
      <path
        d="M9 13.2c.7.7 1.7 1.1 3 1.1s2.3-.4 3-1.1"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg {...iconProps}>
      <rect
        x="3.5"
        y="3.5"
        width="17"
        height="17"
        rx="4.5"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle
        cx="12"
        cy="12"
        r="4"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M14.5 8.5H16V5.8c-.3 0-1.5-.2-2.8-.2-2.8 0-4.7 1.7-4.7 4.8V13H6v3h2.5v6.5h3.2V16H14l.5-3h-2.8V10.7c0-.9.2-2.2 2.3-2.2Z"
        fill="currentColor"
      />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg {...iconProps}>
      <path
        d="M14.2 4v9.1c0 2.2-1.8 4-4 4s-4-1.8-4-4 1.8-4 4-4c.3 0 .6 0 .9.1v2.4a1.7 1.7 0 0 0-.9-.2 1.7 1.7 0 1 0 1.7 1.7V4h2.3Zm2.3 0c.6 1.8 2.1 3.2 4 3.7v2.5c-1.6-.1-3.1-.7-4.3-1.7v4.3c0 3.5-2.8 6.3-6.3 6.3S3.6 16.3 3.6 12.8 6.4 6.5 9.9 6.5c.5 0 1 .1 1.5.2V9c-.4-.2-.9-.3-1.4-.3-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8 3.8-1.7 3.8-3.8V4h2.7Z"
        fill="currentColor"
      />
    </svg>
  );
}
