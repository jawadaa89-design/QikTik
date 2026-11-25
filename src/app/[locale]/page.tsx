import { notFound } from "next/navigation";

type Props = {
  params: Promise<{ locale: string }>;
};

/**
 * Locale root is not a guest page — venue home is /main (via /r/{slug} rewrite).
 */
export default async function LocaleHome({ params }: Props) {
  await params;
  notFound();
}
