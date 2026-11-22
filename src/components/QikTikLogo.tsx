import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Kept for call-site compatibility; always renders the compact corner mark. */
  variant?: "hero" | "corner";
  priority?: boolean;
};

/** Compact QikTik product mark — place in the physical top-right corner, never as the main brand. */
export function QikTikLogo({ className, priority }: Props) {
  return (
    <Image
      src="/qiktik-logo.png?v=2"
      alt="QikTik"
      width={110}
      height={40}
      className={cn(
        "h-7 w-auto rounded-md object-contain object-center bg-[#f6f3ee] p-px shadow-sm ring-1 ring-white/10",
        className,
      )}
      priority={priority}
    />
  );
}
