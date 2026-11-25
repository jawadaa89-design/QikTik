"use client";

import Image from "next/image";
import { useVenueLogoSrc } from "@/components/VenueThemeProvider";

type Props = {
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
};

/** Circular restaurant mark — uses venue branding when available. */
export function VenueLogo({
  alt,
  width = 72,
  height = 72,
  className = "h-[4.5rem] w-[4.5rem] rounded-full object-cover ring-1 ring-brass/40",
  priority,
}: Props) {
  const src = useVenueLogoSrc();
  const remote = src.startsWith("http://") || src.startsWith("https://");

  if (remote) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={width}
        height={height}
        className={className}
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
