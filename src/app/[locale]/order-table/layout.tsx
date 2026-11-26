import { getTranslations, setRequestLocale } from "next-intl/server";
import { DigitalMenuLink } from "@/components/DigitalMenuLink";
import { QikTikLogo } from "@/components/QikTikLogo";
import { hasFeature } from "@/lib/features";
import { resolveVenue } from "@/lib/venue";
import { venueSlugForLayout } from "@/lib/venue-request.server";

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export default async function OrderTableGuestLayout({ children, params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  const venue = await resolveVenue({ slug: await venueSlugForLayout() });
  if (venue && (await hasFeature("ordering", venue.id))) {
    return children;
  }

  const t = await getTranslations("pickup");

  return (
    <main className="guest-shell flex min-h-full flex-col items-center justify-center px-5 pb-10 pt-10">
      <QikTikLogo className="absolute end-4 top-4" />
      <div className="guest-panel w-full max-w-md rounded-2xl p-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-ink">
          {t("featureDisabledTitle")}
        </h1>
        <p className="mt-2 text-sm text-ink-soft/70">{t("featureDisabledBody")}</p>
        <DigitalMenuLink
          locale={locale}
          label={t("digitalMenu")}
          variant="panel"
        />
      </div>
    </main>
  );
}
