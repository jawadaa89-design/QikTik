import { redirect } from "next/navigation";
import { hasFeature } from "@/lib/features";
import CartPage from "./CartPage";

type Props = {
  params: Promise<{ locale: string; token: string }>;
};

export default async function CartRoute({ params }: Props) {
  const { locale, token } = await params;
  if (!(await hasFeature("ordering"))) {
    redirect(`/${locale}/t/${token}`);
  }
  return <CartPage locale={locale} token={token} />;
}
