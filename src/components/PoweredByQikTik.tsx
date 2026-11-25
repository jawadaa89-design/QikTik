import { cn } from "@/lib/utils";

const QIKTIK_SITE = "https://qiktik.tech";

type Props = {
  className?: string;
};

/** Small product credit — pin at the end of every guest/staff page. */
export function PoweredByQikTik({ className }: Props) {
  return (
    <p
      className={cn(
        "px-4 py-2 text-center text-[10px] leading-none tracking-wide",
        className
      )}
    >
      <a
        href={QIKTIK_SITE}
        className="text-ink-soft/40 transition hover:text-brass"
      >
        Powered By: QikTik.tech
      </a>
    </p>
  );
}

/** Inline HTML for SSR staff boards (pickup / alerts). */
export function poweredByQikTikHtml(): string {
  return `<p style="margin:0;padding:12px 16px;text-align:center;font-size:10px;letter-spacing:0.04em"><a href="${QIKTIK_SITE}" style="color:rgba(242,239,232,0.35);text-decoration:none">Powered By: QikTik.tech</a></p>`;
}
