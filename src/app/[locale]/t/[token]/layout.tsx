import { CartProvider } from "@/components/CartProvider";
import { GuestAuthProvider } from "@/components/GuestAuthProvider";
import { GuestAuthGate } from "@/components/GuestAuthGate";
import { FeaturesProvider } from "@/components/FeaturesProvider";
import { getActivePackage } from "@/lib/features";
import { getTableByToken } from "@/lib/menu-service";

type Props = {
  children: React.ReactNode;
  params: Promise<{ token: string }>;
};

export default async function TableLayout({ children, params }: Props) {
  const { token } = await params;
  const table = await getTableByToken(token);
  const pkg = await getActivePackage(table?.venueId);

  return (
    <FeaturesProvider
      initial={pkg.features}
      initialPackageId={pkg.id}
    >
      <GuestAuthProvider key={token} token={token}>
        <CartProvider storageKey={token}>
          <GuestAuthGate key={token}>{children}</GuestAuthGate>
        </CartProvider>
      </GuestAuthProvider>
    </FeaturesProvider>
  );
}
