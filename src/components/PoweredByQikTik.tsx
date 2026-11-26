import { cn } from "@/lib/utils";

const QIKTIK_SITE = "https://qiktik.tech";
const YEAR = new Date().getFullYear();

type Props = {
  className?: string;
};

/** Small product credit — pin at the end of every guest/staff page. */
export function PoweredByQikTik({ className }: Props) {
  return (
    <div
      className={cn(
        "px-4 py-2 text-center text-[10px] leading-snug tracking-wide",
        className
      )}
    >
      <p className="m-0">
        <a
          href={QIKTIK_SITE}
          className="text-ink-soft/40 transition hover:text-brass"
        >
          Powered By: QikTik.tech
        </a>
      </p>
      <p className="m-0 mt-1 text-ink-soft/30">
        © {YEAR} QikTik. All rights reserved.
      </p>
    </div>
  );
}

/** Inline HTML for SSR staff boards (pickup / alerts). */
export function poweredByQikTikHtml(): string {
  return `<div style="margin:0;padding:12px 16px;text-align:center;font-size:10px;letter-spacing:0.04em;line-height:1.35"><p style="margin:0"><a href="${QIKTIK_SITE}" style="color:rgba(242,239,232,0.35);text-decoration:none">Powered By: QikTik.tech</a></p><p style="margin:4px 0 0;color:rgba(242,239,232,0.28)">© ${YEAR} QikTik. All rights reserved.</p></div>`;
}
