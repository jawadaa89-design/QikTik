/**
 * Generate Coffee Up QR PNGs + printable HTML under public/qr/coffee-up/
 * and refresh the shared public/qr placards to point at Coffee Up.
 *
 *   npx tsx scripts/generate-coffee-up-qrs.ts
 */
import { mkdir, writeFile, readFile } from "fs/promises";
import path from "path";
import QRCode from "qrcode";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BASE = "https://app.qiktik.tech";
const SLUG = "coffee-up";
const OUT = path.join(process.cwd(), "public", "qr");
const OUT_CU = path.join(OUT, "coffee-up");

async function writeQrPng(filePath: string, url: string) {
  const buf = await QRCode.toBuffer(url, {
    type: "png",
    width: 512,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0c100e", light: "#ffffff" },
  });
  await writeFile(filePath, buf);
  console.log("  PNG", path.relative(process.cwd(), filePath), "→", url);
}

function simpleCardHtml(opts: {
  title: string;
  venueName: string;
  label: string;
  qrFile: string;
  url: string;
  logoSrc: string;
  accent?: string;
}): string {
  const accent = opts.accent || "#c4a35a";
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${opts.label} — ${opts.venueName}</title>
    <style>
      @page { size: A6; margin: 12mm; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: Georgia, "Times New Roman", serif;
        background: #0c100e;
        color: #f5f5f0;
      }
      .card {
        width: min(360px, 92vw);
        text-align: center;
        padding: 28px 24px 32px;
        border: 1px solid color-mix(in srgb, ${accent} 35%, transparent);
        background: linear-gradient(180deg, #141a17, #0c100e);
      }
      img.logo {
        width: 88px;
        height: 88px;
        border-radius: 999px;
        object-fit: cover;
        border: 1px solid color-mix(in srgb, ${accent} 45%, transparent);
        background: #f6f3ee;
      }
      h1 { margin: 14px 0 4px; font-size: 1.35rem; font-weight: 600; }
      .label {
        margin: 0 0 18px;
        letter-spacing: 0.22em;
        text-transform: uppercase;
        font-size: 0.72rem;
        color: ${accent};
      }
      img.qr { width: 220px; height: 220px; background: #fff; padding: 10px; }
      .hint { margin: 16px 0 0; font-size: 0.85rem; color: rgba(245, 245, 240, 0.65); }
      .url {
        margin-top: 10px;
        font-family: ui-monospace, Consolas, monospace;
        font-size: 0.62rem;
        word-break: break-all;
        color: rgba(245, 245, 240, 0.4);
      }
      @media print {
        body { background: #fff; color: #111; }
        .card { border-color: #ccc; background: #fff; }
        .label { color: #8a7040; }
        .hint, .url { color: #555; }
      }
    </style>
  </head>
  <body>
    <div class="card">
      <img class="logo" src="${opts.logoSrc}" alt="${opts.venueName}" />
      <h1>${opts.venueName}</h1>
      <p class="label">${opts.label}</p>
      <img class="qr" src="${opts.qrFile}" alt="QR code" />
      <p class="hint">${opts.title}</p>
      <p class="url">${opts.url}</p>
    </div>
  </body>
</html>
`;
}

async function main() {
  const venue = await prisma.venue.findUnique({ where: { slug: SLUG } });
  if (!venue) throw new Error(`Venue ${SLUG} not found`);

  const tables = await prisma.table.findMany({
    where: { venueId: venue.id },
    orderBy: { number: "asc" },
    select: { number: true, token: true },
  });

  await mkdir(OUT_CU, { recursive: true });

  const logoUrl = venue.logoUrl?.trim() || "/logo.png";
  const logoSrc = logoUrl.startsWith("http")
    ? logoUrl
    : `../../${logoUrl.replace(/^\//, "")}`;

  const menuUrl = `${BASE}/r/${SLUG}/ar/menu`;
  const guestPickupUrl = `${BASE}/r/${SLUG}/ar/pickup`;
  const staffPickupUrl = `${BASE}/r/${SLUG}/pickup`;
  const alertsUrl = `${BASE}/r/${SLUG}/alerts`;
  const adminUrl = `${BASE}/r/${SLUG}/admin`;

  console.log(`Coffee Up QRs → ${OUT_CU}`);

  await writeQrPng(path.join(OUT_CU, "menu.png"), menuUrl);
  await writeQrPng(path.join(OUT_CU, "pickup.png"), guestPickupUrl);
  await writeQrPng(path.join(OUT_CU, "pickup-board.png"), staffPickupUrl);
  await writeQrPng(path.join(OUT_CU, "alerts.png"), alertsUrl);
  await writeQrPng(path.join(OUT_CU, "admin.png"), adminUrl);

  // Also refresh shared public/qr root assets used by existing HTML placards
  await writeQrPng(path.join(OUT, "menu.png"), menuUrl);
  await writeQrPng(path.join(OUT, "pickup.png"), guestPickupUrl);
  await writeQrPng(path.join(OUT, "pickup-board.png"), staffPickupUrl);

  for (const t of tables) {
    const tableUrl = `${BASE}/r/${SLUG}/ar/t/${t.token}`;
    await writeQrPng(path.join(OUT_CU, `table-${t.number}.png`), tableUrl);
    if (t.number === 7 || tables.length === 1) {
      await writeQrPng(path.join(OUT, "table-7.png"), tableUrl);
    }
  }

  // Coffee Up printable cards
  await writeFile(
    path.join(OUT_CU, "menu.html"),
    simpleCardHtml({
      venueName: venue.name,
      label: "Digital menu",
      title: "Scan to open the menu",
      qrFile: "menu.png",
      url: menuUrl,
      logoSrc,
    })
  );
  await writeFile(
    path.join(OUT_CU, "pickup-guest.html"),
    simpleCardHtml({
      venueName: venue.name,
      label: "Guest pickup",
      title: "Scan to register for pickup",
      qrFile: "pickup.png",
      url: guestPickupUrl,
      logoSrc,
      accent: "#b58d54",
    })
  );
  await writeFile(
    path.join(OUT_CU, "staff-board.html"),
    simpleCardHtml({
      venueName: venue.name,
      label: "Staff · Pickup board",
      title: "Scan to open the staff pickup board",
      qrFile: "pickup-board.png",
      url: staffPickupUrl,
      logoSrc,
      accent: "#f97316",
    })
  );
  await writeFile(
    path.join(OUT_CU, "alerts.html"),
    simpleCardHtml({
      venueName: venue.name,
      label: "Alerts board",
      title: "Scan to open alerts",
      qrFile: "alerts.png",
      url: alertsUrl,
      logoSrc,
      accent: "#d47272",
    })
  );

  for (const t of tables) {
    const tableUrl = `${BASE}/r/${SLUG}/ar/t/${t.token}`;
    await writeFile(
      path.join(OUT_CU, `table-${t.number}.html`),
      simpleCardHtml({
        venueName: venue.name,
        label: `Table ${t.number}`,
        title: "Scan to open the menu at this table",
        qrFile: `table-${t.number}.png`,
        url: tableUrl,
        logoSrc,
        accent: "#f97316",
      })
    );
  }

  // Update root menu.html + table-7.html + staff-board.html for Coffee Up
  await writeFile(
    path.join(OUT, "menu.html"),
    simpleCardHtml({
      venueName: venue.name,
      label: "Digital menu",
      title: "Scan to open the menu",
      qrFile: "menu.png",
      url: menuUrl,
      logoSrc: logoUrl.startsWith("http") ? logoUrl : `../${logoUrl.replace(/^\//, "")}`,
    })
  );

  const table7 =
    tables.find((t) => t.number === 7) || tables[0];
  if (table7) {
    const tableUrl = `${BASE}/r/${SLUG}/ar/t/${table7.token}`;
    await writeFile(
      path.join(OUT, "table-7.html"),
      simpleCardHtml({
        venueName: venue.name,
        label: `Table ${table7.number}`,
        title: "Scan to open the menu",
        qrFile: "table-7.png",
        url: tableUrl,
        logoSrc: logoUrl.startsWith("http")
          ? logoUrl
          : `../${logoUrl.replace(/^\//, "")}`,
        accent: "#f97316",
      })
    );
  }

  await writeFile(
    path.join(OUT, "staff-board.html"),
    `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Staff pickup board — ${venue.name}</title>
    <style>
      :root { --ink:#0c110f; --paper:#f4f6f4; --accent:#f97316; --muted:#5a6574; }
      * { box-sizing: border-box; }
      body { margin:0; min-height:100vh; display:grid; place-items:center; padding:24px; background:var(--paper); color:var(--ink); font-family:"Segoe UI",system-ui,sans-serif; }
      .card { width:min(420px,100%); text-align:center; padding:32px 28px; border:1px solid rgba(12,17,15,.12); border-radius:20px; background:#fff; }
      .eyebrow { font-size:11px; letter-spacing:.22em; text-transform:uppercase; color:var(--accent); font-weight:700; }
      h1 { margin:10px 0 0; font-size:28px; line-height:1.15; }
      p { margin:12px 0 0; color:var(--muted); font-size:15px; line-height:1.45; }
      img { display:block; width:min(280px,100%); margin:24px auto 0; border-radius:12px; }
      .url { margin-top:18px; word-break:break-all; font-size:14px; font-weight:600; color:var(--accent); text-decoration:none; }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="eyebrow">${venue.name} · Staff</div>
      <h1>Pickup board</h1>
      <p>Same link on iPad, PC, and phone. Scan or open the URL, unlock with the staff password.</p>
      <img src="./pickup-board.png" width="512" height="512" alt="QR code for staff pickup board" />
      <a class="url" href="${staffPickupUrl}">${staffPickupUrl}</a>
    </div>
  </body>
</html>
`
  );

  // Patch pickup.html URLs (keep Coffee Up placard design)
  const pickupHtmlPath = path.join(OUT, "pickup.html");
  let pickupHtml = await readFile(pickupHtmlPath, "utf8");
  pickupHtml = pickupHtml
    .replaceAll("https://app.qiktik.tech/r/myrestaurant/ar/pickup", guestPickupUrl)
    .replaceAll("/r/myrestaurant/ar/pickup", `/r/${SLUG}/ar/pickup`)
    .replaceAll("My Restaurant", venue.name)
    .replaceAll("Guest Pickup Placard — My Restaurant", `Guest Pickup Placard — ${venue.name}`);
  // Prefer local regenerated pickup.png
  if (!pickupHtml.includes('src="pickup.png"') && pickupHtml.includes("pickup.png")) {
    /* already relative */
  }
  await writeFile(pickupHtmlPath, pickupHtml);

  // Index for coffee-up folder
  const indexRows = [
    ["menu.html", "Guest menu", menuUrl],
    ["pickup-guest.html", "Guest pickup", guestPickupUrl],
    ["staff-board.html", "Staff pickup board", staffPickupUrl],
    ["alerts.html", "Alerts board", alertsUrl],
    ...tables.map((t) => [
      `table-${t.number}.html`,
      `Table ${t.number}`,
      `${BASE}/r/${SLUG}/ar/t/${t.token}`,
    ]),
  ];
  await writeFile(
    path.join(OUT_CU, "index.html"),
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${venue.name} — QR pack</title>
  <style>
    body{font-family:system-ui,sans-serif;background:#0c100e;color:#f2efe8;margin:0;padding:32px}
    a{color:#c4a35a}
    li{margin:8px 0}
    code{font-size:12px;color:#aaa}
  </style>
</head>
<body>
  <h1>${venue.name} QR pack</h1>
  <p>Printable cards + PNG codes for production links.</p>
  <ul>
    ${indexRows
      .map(
        ([file, label, url]) =>
          `<li><a href="${file}">${label}</a> — <code>${url}</code></li>`
      )
      .join("\n    ")}
  </ul>
</body>
</html>
`
  );

  console.log(`\n✓ Done — ${tables.length} table QRs + menu/pickup/staff/alerts`);
  console.log(`  Folder: public/qr/coffee-up/`);
  console.log(`  Index:  public/qr/coffee-up/index.html`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
