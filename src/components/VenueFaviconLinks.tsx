/** Per-venue favicon / apple-touch icons for layouts that own <head>. */
export function VenueFaviconLinks({ href }: { href: string }) {
  const src = href.trim() || "/logo.png";
  return (
    <>
      <link rel="icon" href={src} sizes="32x32" />
      <link rel="icon" href={src} sizes="192x192" />
      <link rel="shortcut icon" href={src} />
      <link rel="apple-touch-icon" href={src} />
    </>
  );
}
