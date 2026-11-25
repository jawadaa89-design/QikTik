import { toAbsoluteUrl } from "@/lib/to-absolute-url";

export type VenueSummaryLink = {
  label: string;
  url: string;
};

export type VenueSummaryInput = {
  venueName: string;
  slug: string;
  packageLabel: string;
  logoUrl: string | null | undefined;
  links: VenueSummaryLink[];
  /** Optional footer line */
  brandFooter?: string;
};

async function fetchImageBitmap(src: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(src, { mode: "cors", credentials: "omit" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
      if (lines.length >= maxLines) break;
    }
  }
  if (lines.length < maxLines) lines.push(current);
  if (lines.length > maxLines) return lines.slice(0, maxLines);
  // Truncate last line if a single long token overflows
  const last = lines[lines.length - 1];
  if (ctx.measureText(last).width > maxWidth) {
    let truncated = last;
    while (truncated.length > 1 && ctx.measureText(`${truncated}…`).width > maxWidth) {
      truncated = truncated.slice(0, -1);
    }
    lines[lines.length - 1] = `${truncated}…`;
  }
  return lines;
}

function fitUrl(ctx: CanvasRenderingContext2D, url: string, maxWidth: number): string {
  if (ctx.measureText(url).width <= maxWidth) return url;
  let truncated = url;
  while (truncated.length > 8 && ctx.measureText(`${truncated}…`).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return `${truncated}…`;
}

/**
 * Compose a PNG summary card: venue logo/name/package + each active link with QR.
 */
export async function renderVenueSummaryPng(
  input: VenueSummaryInput
): Promise<Blob> {
  const links = input.links.filter((l) => l.url.trim());
  if (links.length === 0) {
    throw new Error("No links to export");
  }

  const absoluteLinks = links.map((l) => ({
    label: l.label,
    url: toAbsoluteUrl(l.url),
  }));

  const cols = absoluteLinks.length >= 3 ? 2 : 1;
  const width = cols === 2 ? 1200 : 900;
  const pad = 48;
  const headerH = 200;
  const footerH = 56;
  const gap = 20;
  const cardPad = 20;
  const qrSize = cols === 2 ? 168 : 200;
  const cardH = cardPad * 2 + qrSize + 72;
  const innerW = width - pad * 2;
  const cardW = cols === 2 ? (innerW - gap) / 2 : innerW;
  const rows = Math.ceil(absoluteLinks.length / cols);
  const height = pad + headerH + gap + rows * cardH + (rows - 1) * gap + footerH + pad;

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, height);
  bg.addColorStop(0, "#141a17");
  bg.addColorStop(1, "#0c100e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Outer brass frame
  ctx.strokeStyle = "rgba(196,163,90,0.35)";
  ctx.lineWidth = 2;
  roundRect(ctx, 18, 18, width - 36, height - 36, 28);
  ctx.stroke();

  // Load assets in parallel
  const logoSrc = input.logoUrl?.trim() || "/logo.png";
  const [logoBmp, ...qrBmps] = await Promise.all([
    fetchImageBitmap(logoSrc),
    ...absoluteLinks.map((l) =>
      fetchImageBitmap(`/api/v1/qr?url=${encodeURIComponent(l.url)}`)
    ),
  ]);

  // Header logo circle
  const logoSize = 96;
  const logoX = pad;
  const logoY = pad + 28;
  ctx.save();
  ctx.beginPath();
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#f6f3ee";
  ctx.fillRect(logoX, logoY, logoSize, logoSize);
  if (logoBmp) {
    // cover-fit
    const scale = Math.max(logoSize / logoBmp.width, logoSize / logoBmp.height);
    const dw = logoBmp.width * scale;
    const dh = logoBmp.height * scale;
    ctx.drawImage(logoBmp, logoX + (logoSize - dw) / 2, logoY + (logoSize - dh) / 2, dw, dh);
  }
  ctx.restore();
  ctx.strokeStyle = "rgba(196,163,90,0.55)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(logoX + logoSize / 2, logoY + logoSize / 2, logoSize / 2 + 1.5, 0, Math.PI * 2);
  ctx.stroke();

  const textX = logoX + logoSize + 28;
  const textMax = width - textX - pad;

  ctx.fillStyle = "#c4a35a";
  ctx.font = "600 13px system-ui, Segoe UI, sans-serif";
  ctx.letterSpacing = "0.16em";
  ctx.fillText("QIKTIK VENUE SUMMARY", textX, logoY + 18);
  ctx.letterSpacing = "0px";

  ctx.fillStyle = "#f2efe8";
  ctx.font = "600 36px Georgia, 'Times New Roman', serif";
  const nameLines = wrapText(ctx, input.venueName || "Venue", textMax, 2);
  let nameY = logoY + 56;
  for (const line of nameLines) {
    ctx.fillText(line, textX, nameY);
    nameY += 40;
  }

  // Package badge
  const pkg = input.packageLabel || "Package";
  ctx.font = "700 14px system-ui, Segoe UI, sans-serif";
  const pkgW = Math.min(ctx.measureText(pkg).width + 28, textMax);
  const pkgY = nameY + 8;
  roundRect(ctx, textX, pkgY, pkgW, 32, 16);
  ctx.fillStyle = "rgba(196,163,90,0.18)";
  ctx.fill();
  ctx.strokeStyle = "rgba(196,163,90,0.45)";
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = "#c4a35a";
  ctx.fillText(pkg, textX + 14, pkgY + 21);

  ctx.fillStyle = "rgba(242,239,232,0.45)";
  ctx.font = "500 13px ui-monospace, Consolas, monospace";
  ctx.fillText(`/${input.slug}`, textX, pkgY + 56);

  // Link cards
  const gridTop = pad + headerH + gap;
  for (let i = 0; i < absoluteLinks.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = pad + col * (cardW + gap);
    const y = gridTop + row * (cardH + gap);
    const link = absoluteLinks[i];
    const qr = qrBmps[i];

    roundRect(ctx, x, y, cardW, cardH, 18);
    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.stroke();

    // QR white pad
    const qrX = x + cardPad;
    const qrY = y + cardPad;
    roundRect(ctx, qrX, qrY, qrSize, qrSize, 12);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    if (qr) {
      const inset = 10;
      ctx.drawImage(qr, qrX + inset, qrY + inset, qrSize - inset * 2, qrSize - inset * 2);
    }

    const labelX = qrX + qrSize + 18;
    const labelMax = cardW - cardPad - qrSize - 18 - cardPad;
    ctx.fillStyle = "#c4a35a";
    ctx.font = "700 11px system-ui, Segoe UI, sans-serif";
    ctx.fillText("QR LINK", labelX, qrY + 22);

    ctx.fillStyle = "#f2efe8";
    ctx.font = "600 20px system-ui, Segoe UI, sans-serif";
    const labelLines = wrapText(ctx, link.label, labelMax, 2);
    let ly = qrY + 52;
    for (const line of labelLines) {
      ctx.fillText(line, labelX, ly);
      ly += 26;
    }

    ctx.fillStyle = "rgba(242,239,232,0.5)";
    ctx.font = "500 12px ui-monospace, Consolas, monospace";
    const urlLines = wrapText(
      ctx,
      fitUrl(ctx, link.url, labelMax * 2),
      labelMax,
      3
    );
    ly += 10;
    for (const line of urlLines) {
      ctx.fillText(line, labelX, ly);
      ly += 16;
    }
  }

  // Footer
  const footerY = height - pad - 18;
  ctx.fillStyle = "rgba(196,163,90,0.7)";
  ctx.font = "600 12px system-ui, Segoe UI, sans-serif";
  ctx.fillText(input.brandFooter || "Powered by QikTik · app.qiktik.tech", pad, footerY);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("PNG encode failed"));
      },
      "image/png",
      1
    );
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}
