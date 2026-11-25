import { redirect } from "next/navigation";
import { hasFeature } from "@/lib/features";
import { getTableByToken } from "@/lib/menu-service";
import OrdersPage from "./OrdersPage";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function OrdersRoute({ params }: Props) {
  const { locale, token } = await params;
  const table = await getTableByToken(token);
  if (!(await hasFeature("ordering", table?.venueId))) {
    redirect(`/${locale}/t/${token}`);
  }
  return <OrdersPage locale={locale} token={token} />;
}
