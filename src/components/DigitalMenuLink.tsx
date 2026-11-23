import Image from "next/image";
import Link from "next/link";
import { guestDigitalMenuHref } from "@/lib/guest-menu-url";

type Props = {
  locale: string;
  label: string;
  venueSlug?: string;
  /** Compact app-icon tile (registration / waiting) vs compact panel CTA. */
  variant?: "prominent" | "panel";
  className?: string;
};

const MENU_TILE_IMAGE = "/menu/mixed-grill.jpg";

/** Guest-facing link into menu browse — not staff chrome. */
export function DigitalMenuLink({
  locale,
  label,
  venueSlug,
  variant = "prominent",
  className = "",
}: Props) {
  const href = guestDigitalMenuHref(locale, venueSlug);

  if (variant === "panel") {
    return (
      <Link
        href={href}
        className={`mt-6 inline-block rounded-xl bg-brass px-4 py-2.5 text-sm font-semibold text-[#0c100e] ${className}`}
      >
        {label}
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={`group mx-auto flex w-fit focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${className}`}
    >
      <span className="relative h-28 w-28 shrink-0 overflow-hidden rounded-[1.5rem] border border-brass/35 shadow-[0_6px_18px_rgba(0,0,0,0.28)] transition group-hover:border-brass/60 group-hover:shadow-[0_8px_22px_rgba(0,0,0,0.34)]">
        <Image
          src={MENU_TILE_IMAGE}
          alt=""
          fill
          sizes="112px"
          className="object-cover transition duration-500 group-hover:scale-[1.04]"
          priority
        />
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/45 to-black/20"
        />
        <span className="absolute inset-0 flex items-center justify-center px-1.5 text-center text-xs font-semibold leading-tight text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]">
          {label}
        </span>
      </span>
    </Link>
  );
}
