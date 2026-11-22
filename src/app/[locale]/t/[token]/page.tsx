import { notFound } from "next/navigation";
import { GuestMenuClient } from "./GuestMenuClient";
import { setRequestLocale } from "next-intl/server";
import { getMenuForVenue, getTableByToken } from "@/lib/menu-service";
import type { Locale } from "@/i18n/config";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function TableMenuPage({ params }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);

  const table = await getTableByToken(token);
  if (!table) notFound();

  const categories = await getMenuForVenue(table.venueId, locale as Locale);

  return (
    <GuestMenuClient
      locale={locale}
      token={token}
      tableNumber={table.number}
      venueName={table.venue.name}
      categories={categories}
    />
  );
}
