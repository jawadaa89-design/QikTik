import Image from "next/image";
import Link from "next/link";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { QikTikLogo } from "@/components/QikTikLogo";
import { defaultLocale, localeNames, locales, type Locale } from "@/i18n/config";
import { getVenueFeatures } from "@/lib/features";

const DEMO_TOKEN = "t_table7demo2026";
const venueName = process.env.NEXT_PUBLIC_VENUE_NAME ?? "My Restaurant";

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function LocaleHome({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("language");
  const tCommon = await getTranslations("common");
  const tPickup = await getTranslations("pickup");
  const features = await getVenueFeatures();

  return (
    <main className="guest-shell flex flex-col px-5 pb-10 pt-10">
      <div className="relative overflow-hidden rounded-[1.75rem] border border-white/8 bg-[#121816] px-6 pb-10 pt-8 text-center animate-rise">
        <div className="absolute -start-8 -top-10 h-40 w-40 rounded-full bg-brass/15 blur-3xl" />
        <div className="absolute -bottom-12 -end-6 h-44 w-44 rounded-full bg-ready/10 blur-3xl" />
        <QikTikLogo className="absolute top-3 end-3 z-10" />
        <div className="relative flex flex-col items-center">
          <Image
            src="/logo.png"
            alt={venueName}
            width={176}
            height={176}
            className="h-44 w-44 rounded-full object-cover ring-2 ring-brass/45"
            priority
          />
          <h1 className="mt-5 font-display text-3xl font-semibold leading-tight text-ink">
            {venueName}
          </h1>
          <p className="mt-1 text-sm text-ink-soft/55">demo table 7</p>
        </div>
      </div>

      <section className="mt-8 animate-rise-delay-1">
        <h2 className="mb-3 text-center text-sm font-semibold tracking-wide text-ink-soft/60">
          {t("title")}
        </h2>
        <div className="flex flex-col gap-2">
          {locales.map((loc) => (
            <Link
              key={loc}
              href={`/${loc}/t/${DEMO_TOKEN}`}
              className="guest-panel flex items-center justify-between rounded-2xl px-4 py-3.5 transition hover:border-brass/35"
            >
              <span className="font-semibold text-ink">{localeNames[loc as Locale]}</span>
              <span className="text-brass">→</span>
            </Link>
          ))}
        </div>
      </section>

      {features.pickup ? (
        <section className="mt-6 animate-rise-delay-2">
          <Link
            href={`/${defaultLocale}/pickup`}
            className="guest-panel flex items-center justify-between rounded-2xl px-4 py-3.5 transition hover:border-brass/35"
          >
            <span className="font-semibold text-ink">{tPickup("homeLink")}</span>
            <span className="text-brass">→</span>
          </Link>
        </section>
      ) : null}

      <p className="mt-8 text-center text-xs text-ink-soft/35">{tCommon("tapOrScan")}</p>
    </main>
  );
}
