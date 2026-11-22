import { redirect } from "next/navigation";
import { hasFeature } from "@/lib/features";
import OrdersPage from "./OrdersPage";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function OrdersRoute({ params }: Props) {
  const { locale, token } = await params;
  if (!(await hasFeature("ordering"))) {
    redirect(`/${locale}/t/${token}`);
  }
  return <OrdersPage locale={locale} token={token} />;
}
