import Image from "next/image";
import { cn } from "@/lib/utils";

const QIKTIK_SITE = "https://qiktik.tech";

type Props = {
  className?: string;
  /** Kept for call-site compatibility; always renders the compact corner mark. */
  variant?: "hero" | "corner";
  priority?: boolean;
};

/** Compact QikTik product mark — links to qiktik.tech; pin with `absolute end-* top-*` (RTL-safe). */
export function QikTikLogo({ className, priority }: Props) {
  return (
    <a
      href={QIKTIK_SITE}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="QikTik website"
      title="qiktik.tech"
      className="inline-flex shrink-0"
    >
      <Image
        src="/qiktik-logo.png?v=3"
        alt="QikTik"
        width={110}
        height={40}
        className={cn(
          "h-7 w-auto rounded-md object-contain object-center bg-[#f6f3ee] p-px shadow-sm ring-1 ring-white/10",
          className,
        )}
        priority={priority}
      />
    </a>
  );
}
