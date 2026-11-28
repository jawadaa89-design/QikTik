import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createStaffSessionValue,
  parseStaffSession,
  staffSessionCookieOptions,
  verifyStaffPassword,
} from "@/lib/staff-auth";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { VENUE_SLUG_COOKIE, VENUE_SLUG_HEADER } from "@/lib/venue-paths";
import { MOBILE_PULL_REFRESH_SCRIPT } from "@/lib/mobile-pull-refresh-script";
import {
  STAFF_LOCALE_KEY,
  isRtl,
  localeNames,
  locales,
  pickupMessages,
  staffGateMessages,
} from "@/i18n/staff";
import { expireStaleStaffBoardItems } from "@/lib/pickup-expire";
import { poweredByQikTikHtml } from "@/components/PoweredByQikTik";
import {
  brandFromVenue,
  venueFaviconLinkTags,
  venueLogoSrc,
} from "@/lib/venue-brand";

function venueSlugFromReq(
  req: NextRequest,
  formVenue?: string | null
): string {
  const fromForm = formVenue?.trim();
  if (fromForm) return fromForm.toLowerCase();
  const fromHeader = req.headers.get(VENUE_SLUG_HEADER)?.trim();
  if (fromHeader) return fromHeader.toLowerCase();
  const fromQuery = req.nextUrl.searchParams.get("venue")?.trim();
  if (fromQuery) return fromQuery.toLowerCase();
  const fromCookie = req.cookies.get(VENUE_SLUG_COOKIE)?.value?.trim();
  if (fromCookie) return fromCookie.toLowerCase();
  return DEFAULT_VENUE_SLUG;
}

const LOCALE_JSON = JSON.stringify({
  key: STAFF_LOCALE_KEY,
  locales,
  names: localeNames,
  rtl: Object.fromEntries(locales.map((l) => [l, isRtl(l)])),
  pickup: pickupMessages,
  gate: staffGateMessages,
});

function langSelectHtml(labelKey: "language" = "language") {
  const opts = locales
    .map((l) => `<option value="${l}">${esc(localeNames[l])}</option>`)
    .join("");
  return `<label class="lang">
    <span class="sr-only" data-i18n="${labelKey}">Language</span>
    <select id="staff-lang" aria-label="Language" data-i18n-aria="${labelKey}">
      ${opts}
    </select>
  </label>`;
}

function i18nBootScript(mode: "board" | "login") {
  return `<script>
(function () {
  var CFG = ${LOCALE_JSON};
  var MODE = ${JSON.stringify(mode)};
  function stored() {
    try {
      var v = localStorage.getItem(CFG.key);
      if (v && CFG.pickup[v]) return v;
    } catch (e) {}
    return "ar";
  }
  function save(loc) {
    try { localStorage.setItem(CFG.key, loc); } catch (e) {}
  }
  function msgs(loc) {
    return MODE === "login" ? (CFG.gate[loc] || CFG.gate.en) : (CFG.pickup[loc] || CFG.pickup.en);
  }
  function apply(loc) {
    if (!CFG.pickup[loc]) loc = "ar";
    save(loc);
    document.documentElement.lang = loc;
    document.documentElement.dir = CFG.rtl[loc] ? "rtl" : "ltr";
    var t = msgs(loc);
    var nodes = document.querySelectorAll("[data-i18n]");
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      var key = el.getAttribute("data-i18n");
      if (!key || t[key] == null) continue;
      var count = el.getAttribute("data-count");
      el.textContent = count != null ? (t[key] + " (" + count + ")") : t[key];
    }
    var ariaNodes = document.querySelectorAll("[data-i18n-aria]");
    for (var j = 0; j < ariaNodes.length; j++) {
      var a = ariaNodes[j];
      var ak = a.getAttribute("data-i18n-aria");
      if (ak && t[ak] != null) a.setAttribute("aria-label", t[ak]);
    }
    var pt = CFG.pickup[loc] || CFG.pickup.en;
    var hint = document.getElementById("board-hint");
    if (hint && MODE === "board") {
      var venue = hint.getAttribute("data-venue") || "";
      hint.textContent = venue ? (venue + " · " + pt.liveSuffix) : pt.liveSuffix;
    }
    var floorEl = document.getElementById("board-floor");
    if (floorEl && MODE === "board") {
      var floorVenue =
        floorEl.getAttribute("data-venue") ||
        (hint && hint.getAttribute("data-venue")) ||
        "";
      floorEl.textContent = floorVenue
        ? floorVenue + " · " + pt.floor
        : pt.floor;
    }
    var sel = document.getElementById("staff-lang");
    if (sel && sel.value !== loc) sel.value = loc;
    window.__qiktikApplyLocale = apply;
    window.__qiktikLocale = loc;
    window.__qiktikPickupMsgs = function (l) { return CFG.pickup[l] || CFG.pickup.en; };
  }
  document.addEventListener("DOMContentLoaded", function () {
    var loc = stored();
    apply(loc);
    var sel = document.getElementById("staff-lang");
    if (sel) {
      sel.value = loc;
      sel.addEventListener("change", function () {
        apply(sel.value);
      });
    }
  });
  // Expose early for soft-refresh re-apply
  window.__qiktikApplyLocale = apply;
  window.__qiktikGetLocale = stored;
  window.__qiktikPickupMsgs = function (l) { return CFG.pickup[l] || CFG.pickup.en; };
})();
</script>`;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function ageLabel(d: Date) {
  const mins = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60_000));
  if (mins < 1) return "&lt;1m";
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

/**
 * Board session from URL/form token, or an existing staff cookie (e.g. already
 * unlocked on /admin — no second password).
 */
function tokenFromQueryOrForm(
  req: NextRequest,
  formToken: string | undefined,
  venueId: string | undefined
): string | null {
  if (!venueId) return null;
  const candidates = [
    formToken,
    req.nextUrl.searchParams.get("access_token"),
    req.cookies.get("qiktik_staff")?.value,
    req.cookies.get("qiktik_staff_token")?.value,
  ];
  for (const raw of candidates) {
    const session = parseStaffSession(raw);
    if (session && session.venueId === venueId) return raw!;
  }
  return null;
}

function clearStaffCookies(res: NextResponse) {
  res.cookies.set("qiktik_staff", "", { path: "/", maxAge: 0 });
  res.cookies.set("qiktik_staff_token", "", { path: "/", maxAge: 0 });
  return res;
}

async function loadBoard(venueSlug: string) {
  const venue =
    (await prisma.venue.findUnique({ where: { slug: venueSlug } })) ||
    (await prisma.venue.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!venue)
    return {
      venue: null,
      brand: brandFromVenue(null),
      waiting: [],
      ready: [],
      assistance: [],
    };

  try {
    await expireStaleStaffBoardItems({ venueId: venue.id });
  } catch {
    /* board still loads if expire fails */
  }

  const [waiting, ready, assistance] = await Promise.all([
    prisma.pickupTicket.findMany({
      where: { venueId: venue.id, status: "WAITING" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pickupTicket.findMany({
      where: { venueId: venue.id, status: "READY" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pickupAssistanceCall.findMany({
      where: { venueId: venue.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
  ]);
  return {
    venue,
    brand: brandFromVenue(venue),
    waiting,
    ready,
    assistance,
  };
}

function renderLogin(
  venueSlug: string,
  error?: string,
  logoSrc = "/logo.png",
  venueName = "Staff"
) {
  const boardPath = `/r/${esc(venueSlug)}/pickup`;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${esc(venueName)} · Pickup unlock</title>
  ${venueFaviconLinkTags(logoSrc)}
  <style>
    body{margin:0;min-height:100vh;background:#101012;color:#eef2ef;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:100%;max-width:420px;background:#1a1f18;border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:24px;position:relative}
    .top{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .brand{display:flex;align-items:center;gap:12px;margin-top:12px}
    .brand img{width:56px;height:56px;border-radius:999px;object-fit:cover;border:2px solid rgba(249,115,22,.4);background:#f6f3ee;flex-shrink:0}
    h1{margin:0;font-size:24px}
    p{color:#c8c4bb;font-size:14px}
    label.field{display:block;font-size:12px;font-weight:600;color:#c8c4bb;margin-top:16px}
    input{width:100%;box-sizing:border-box;margin-top:8px;padding:14px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#f2efe8;font-size:16px}
    button{width:100%;margin-top:16px;min-height:52px;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:700;background:linear-gradient(135deg,#f97316,#c2410c);color:#0c100e}
    .err{margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid rgba(212,114,114,.4);background:rgba(212,114,114,.12);color:#f0a0a0;font-size:14px}
    .badge{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#f97316;font-weight:600}
    .lang{display:inline-flex;position:relative}
    .lang select{appearance:none;-webkit-appearance:none;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:#1a211c;color:#f2efe8;font-size:12px;font-weight:600;padding:8px 28px 8px 12px}
    .lang select option{background:#fff;color:#111}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
  </style>
  ${i18nBootScript("login")}
</head>
<body>
  <form class="card" method="POST" action="${boardPath}">
    <input type="hidden" name="venue" value="${esc(venueSlug)}" />
    <div class="top">
      <div class="badge" data-i18n="badge">Staff</div>
      ${langSelectHtml()}
    </div>
    <div class="brand">
      <img src="${esc(logoSrc)}" alt="" width="56" height="56" />
      <h1 data-i18n="title">Staff login</h1>
    </div>
    <p>${esc(venueName)} — enter this restaurant’s staff password.</p>
    ${error ? `<div class="err">${esc(error)}</div>` : ""}
    <label class="field" for="password" data-i18n="password">Staff password</label>
    <input id="password" name="password" type="password" required autocomplete="off" />
    <button type="submit" data-i18n="unlock">Unlock</button>
  </form>
  ${MOBILE_PULL_REFRESH_SCRIPT}
  ${poweredByQikTikHtml()}
</body>
</html>`;
}

function renderBoard(
  token: string,
  data: Awaited<ReturnType<typeof loadBoard>>
) {
  // Prefer same-document URL so soft-refresh / POSTs stay on /r/{slug}/pickup.
  const refreshUrl = `?access_token=${encodeURIComponent(token)}`;
  const { waiting, ready, assistance, venue, brand } = data;
  const logoSrc = venueLogoSrc(brand ?? brandFromVenue(venue));
  const venueSlug = venue?.slug || DEFAULT_VENUE_SLUG;
  const boardBase = `/r/${esc(venueSlug)}/pickup`;

  const ticketCard = (
    t: {
      id: string;
      customerName: string;
      orderRef: string | null;
      phone: string | null;
      createdAt: Date;
      status: string;
    },
    actions: string,
    variant: "waiting" | "ready" = "waiting"
  ) => `
    <li class="card ${variant}">
      <div class="card-body">
        <div class="name">${esc(t.customerName)}</div>
        <div class="meta">${ageLabel(t.createdAt)}${t.orderRef ? ` · #${esc(t.orderRef)}` : ""}${t.phone ? ` · ${esc(t.phone)}` : ""}</div>
      </div>
      <div class="actions">${actions}</div>
    </li>`;

  // action="" posts to the current /r/{slug}/pickup URL (venue header intact).
  const action = (id: string, status: string, i18nKey: string, fallback: string, cls: string) => `
    <form method="POST" action="">
      <input type="hidden" name="access_token" value="${esc(token)}" />
      <input type="hidden" name="ticket_id" value="${esc(id)}" />
      <input type="hidden" name="status" value="${esc(status)}" />
      <button class="${cls}" type="submit" data-i18n="${i18nKey}">${esc(fallback)}</button>
    </form>`;

  const pingAction = (id: string) => `
    <form method="POST" action="">
      <input type="hidden" name="access_token" value="${esc(token)}" />
      <input type="hidden" name="ping_ticket_id" value="${esc(id)}" />
      <button class="btn-ping" type="submit" data-i18n="ping">Ping</button>
    </form>`;

  const assistAction = (id: string, status: string, i18nKey: string, fallback: string, cls: string) => `
    <form method="POST" action="">
      <input type="hidden" name="access_token" value="${esc(token)}" />
      <input type="hidden" name="assistance_id" value="${esc(id)}" />
      <input type="hidden" name="assistance_status" value="${esc(status)}" />
      <button class="${cls}" type="submit" data-i18n="${i18nKey}">${esc(fallback)}</button>
    </form>`;

  const openCallsJson = JSON.stringify(
    assistance
      .filter((c) => c.status === "OPEN")
      .map((c) => ({
        id: c.id,
        customerName: c.customerName,
        orderRef: c.orderRef,
        comment: c.comment,
      }))
  );

  const venueName = venue?.name || "Restaurant";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Pickup queue — ${esc(venue?.name || "QikTik")}</title>
  ${venueFaviconLinkTags(logoSrc)}
  <style>
    :root{
      --bg:${esc(brand?.backgroundColor ?? "#0e1210")};
      --panel:${esc(brand?.surfaceColor ?? "#161c18")};
      --line:rgba(255,255,255,.08);
      --ink:${esc(brand?.textColor ?? "#eef2ef")};
      --muted:rgba(200,196,187,.55);
      --orange:${esc(brand?.accentColor ?? "#f97316")};
      --green:#5fad86;
      --red:#d47272;
      --brand-accent:var(--orange);
      --brand-bg:var(--bg);
      --brand-surface:var(--panel);
      --brand-text:var(--ink);
    }
    *{box-sizing:border-box}
    body{
      margin:0;min-height:100vh;color:var(--ink);
      font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      background:
        radial-gradient(ellipse 80% 50% at 10% -10%,color-mix(in srgb,var(--orange) 22%,transparent),transparent 55%),
        radial-gradient(ellipse 60% 40% at 100% 0%,rgba(95,173,134,.1),transparent 50%),
        var(--bg);
    }
    header{
      padding:18px 20px 16px;
      border-bottom:1px solid var(--line);
      background:color-mix(in srgb,var(--bg) 78%,black);
      backdrop-filter:blur(10px);
    }
    .header-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    .header-brand{display:flex;align-items:center;gap:40px;min-width:0}
    .header-brand img{
      width:56px;height:56px;border-radius:999px;object-fit:cover;flex-shrink:0;
      margin-inline-end:8px;
      border:2px solid color-mix(in srgb,var(--orange) 45%,transparent);background:#f6f3ee;
      box-shadow:0 0 0 4px color-mix(in srgb,var(--orange) 12%,transparent);
    }
    .header-brand > div{padding-inline-start:4px}
    .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--orange);opacity:.9;font-weight:700}
    h1{margin:4px 0 0;font-size:clamp(22px,4vw,30px);font-weight:750;letter-spacing:-.02em}
    .hint{margin:8px 0 0;color:var(--muted);font-size:13px}
    main{max-width:1180px;margin:0 auto;padding:18px 16px 28px;display:grid;gap:18px}
    .columns{display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:start}
    @media (max-width:820px){.columns{grid-template-columns:1fr}}
    .panel{
      border-radius:20px;border:1px solid var(--line);background:var(--panel);
      padding:14px;min-height:220px;
      box-shadow:0 12px 40px rgba(0,0,0,.22);
    }
    .panel.waiting{border-color:rgba(249,115,22,.22)}
    .panel.ready-col{border-color:rgba(95,173,134,.28)}
    .panel.assist-panel{border-color:rgba(212,114,114,.28);min-height:0}
    .panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding:2px 4px 10px;border-bottom:1px solid var(--line)}
    h2{margin:0;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--orange);font-weight:800}
    h2.ready{color:var(--green)}
    h2.assist{color:var(--red)}
    .count{
      min-width:28px;height:28px;padding:0 8px;border-radius:999px;
      display:inline-flex;align-items:center;justify-content:center;
      font-size:13px;font-weight:800;background:rgba(255,255,255,.06);color:var(--ink);
    }
    .panel.waiting .count{background:rgba(249,115,22,.18);color:#ffd4b0}
    .panel.ready-col .count{background:rgba(95,173,134,.2);color:#b7ebcd}
    .panel.assist-panel .count{background:rgba(212,114,114,.2);color:#f3c0c0}
    ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
    .card{
      display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center;
      padding:14px 14px;border-radius:14px;
      background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07);
      transition:border-color .15s ease, background .15s ease;
    }
    .card.waiting{border-inline-start:3px solid rgba(249,115,22,.75)}
    .card.ready{border-inline-start:3px solid rgba(95,173,134,.85);border-color:rgba(95,173,134,.28);background:rgba(95,173,134,.1)}
    .card.open{
      position:relative;
      border-inline-start:3px solid #ef4444;
      border-color:rgba(254,202,202,.9);
      background:rgba(185,28,28,.42);
      transition:none;
      -webkit-transform:translateZ(0);
      transform:translateZ(0);
      -webkit-animation:alertPulse .7s ease-in-out infinite;
      animation:alertPulse .7s ease-in-out infinite;
      will-change:opacity,transform;
    }
    .card.open::after{
      content:"";
      pointer-events:none;
      position:absolute;inset:0;border-radius:inherit;
      background:rgba(255,255,255,.22);
      -webkit-animation:alertFlash .7s ease-in-out infinite;
      animation:alertFlash .7s ease-in-out infinite;
    }
    .card-body{min-width:0;flex:1;position:relative;z-index:1}
    .card.open .actions{position:relative;z-index:1}
    .name{font-size:17px;font-weight:700;letter-spacing:-.01em}
    .meta{margin-top:4px;font-size:12px;color:var(--muted);line-height:1.35}
    .actions{display:flex;flex-wrap:wrap;gap:8px}
    button{
      border:0;border-radius:11px;padding:10px 14px;font-size:13px;font-weight:750;
      cursor:pointer;min-height:42px;
    }
    .btn-ready{background:linear-gradient(135deg,#4aa87a,#2f7a56);color:#fff}
    .btn-done{background:linear-gradient(135deg,#fb923c,#ea580c);color:#0c100e}
    .btn-ping{background:linear-gradient(135deg,#38bdf8,#0284c8);color:#0c100e}
    .btn-ghost{background:rgba(255,255,255,.05);color:rgba(238,242,239,.8);border:1px solid rgba(255,255,255,.12)}
    .empty{
      padding:36px 16px;text-align:center;border-radius:14px;
      border:1px dashed rgba(255,255,255,.1);background:rgba(255,255,255,.02);
      color:rgba(200,196,187,.42);font-size:14px;
    }
    .footer{padding:8px 16px 24px;text-align:center;font-size:12px;color:rgba(200,196,187,.4)}
    a{color:var(--orange);text-decoration:none}
    a:hover{text-decoration:underline}
    .lang{display:inline-flex;position:relative;flex-shrink:0}
    .lang select{
      appearance:none;-webkit-appearance:none;border-radius:12px;
      border:1px solid rgba(255,255,255,.2);background:#1a211c;
      color:#f2efe8;font-size:12px;font-weight:600;padding:8px 28px 8px 12px
    }
    .lang select option{background:#fff;color:#111}
    .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);border:0}
    #sound-banner{display:none;margin:12px 16px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(249,115,22,.45);background:rgba(249,115,22,.14);color:#f97316;font-size:14px;font-weight:600;text-align:center;cursor:pointer}
    #sound-banner.show{display:block}
    #call-alert{display:none;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;height:100dvh;z-index:9999;place-items:center;padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));box-sizing:border-box;background:rgba(12,40,28,.82);animation:bgpulse .7s ease-in-out infinite;-webkit-transform:translateZ(0);transform:translateZ(0)}
    #call-alert.show{display:grid}
    #call-alert .panel{-webkit-appearance:none;appearance:none;display:block;width:min(520px,100%);max-width:520px;margin:0;border:4px solid #fecaca;border-radius:24px;background:#b91c1c;padding:40px 24px;text-align:center;box-shadow:0 0 60px rgba(220,38,38,.55);animation:flash .7s ease-in-out infinite;color:#fff;font:inherit;min-height:0}
    #call-alert .badge{font-size:13px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;color:#fee2e2}
    #call-alert h2{margin:16px 0 0;font-size:clamp(28px,6vw,40px);font-weight:800;line-height:1.1;color:#fff;letter-spacing:normal;text-transform:none}
    #call-alert .box{margin-top:12px;border-radius:16px;background:rgba(0,0,0,.2);padding:12px 16px;text-align:start}
    #call-alert .box dt{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#fecaca;opacity:.9}
    #call-alert .box dd{margin:4px 0 0;font-size:clamp(20px,5vw,28px);font-weight:800}
    #call-alert .tap{margin-top:28px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#fecaca;opacity:.9}
    @keyframes flash{0%,100%{opacity:1}50%{opacity:.72}}
    @-webkit-keyframes flash{0%,100%{opacity:1}50%{opacity:.72}}
    @keyframes bgpulse{0%,100%{background-color:rgba(12,40,28,.82)}50%{background-color:rgba(20,90,55,.9)}}
    @-webkit-keyframes bgpulse{0%,100%{background-color:rgba(12,40,28,.82)}50%{background-color:rgba(20,90,55,.9)}}
    /* opacity + scale — reliable on iPad Safari (bg/box-shadow pulses often do not run) */
    @keyframes alertPulse{
      0%,100%{-webkit-transform:translateZ(0) scale(1);transform:translateZ(0) scale(1);opacity:1}
      50%{-webkit-transform:translateZ(0) scale(1.015);transform:translateZ(0) scale(1.015);opacity:.72}
    }
    @-webkit-keyframes alertPulse{
      0%,100%{-webkit-transform:translateZ(0) scale(1);transform:translateZ(0) scale(1);opacity:1}
      50%{-webkit-transform:translateZ(0) scale(1.015);transform:translateZ(0) scale(1.015);opacity:.72}
    }
    @keyframes alertFlash{
      0%,100%{opacity:0}
      50%{opacity:1}
    }
    @-webkit-keyframes alertFlash{
      0%,100%{opacity:0}
      50%{opacity:1}
    }
  </style>
  ${i18nBootScript("board")}
</head>
<body>
  <div id="sound-banner" data-i18n="soundEnable">Tap here to enable call-waiter sound + alerts</div>
  <div id="call-alert" role="alertdialog" aria-modal="true">
    <button type="button" class="panel" id="call-alert-btn">
      <div class="badge" id="call-alert-badge" data-i18n="callWaiterTitle">Call waiter</div>
      <h2 id="call-alert-title" data-i18n="callWaiterBadge">Guest needs help</h2>
      <dl>
        <div class="box"><dt data-i18n="callWaiterName">Guest</dt><dd id="call-alert-name">—</dd></div>
        <div class="box"><dt data-i18n="callWaiterOrderRef">Order / table</dt><dd id="call-alert-ref">—</dd></div>
        <div class="box" id="call-alert-comment-wrap" style="display:none"><dt data-i18n="callWaiterComment">Comment</dt><dd id="call-alert-comment"></dd></div>
      </dl>
      <div class="tap" data-i18n="tapDismiss">Tap to dismiss</div>
    </button>
  </div>
  <header>
    <div class="header-top">
      <div class="header-brand">
        <img src="${esc(logoSrc)}" alt="${esc(venueName)}" width="56" height="56" />
        <div>
          <div class="eyebrow" id="board-floor" data-venue="${esc(venueName)}">${esc(venueName)} · Pickup</div>
          <h1 data-i18n="title">Pickup queue</h1>
        </div>
      </div>
      ${langSelectHtml()}
    </div>
    <p class="hint" id="board-hint" data-venue="${esc(venueName)}">${esc(venueName)} · live alerts + auto-refresh</p>
  </header>
  <main>
    <script type="application/json" id="open-calls-data">${openCallsJson}</script>
    <div class="columns">
      <section class="panel waiting">
        <div class="panel-head">
          <h2 data-i18n="waitingSection">Waiting orders</h2>
          <span class="count">${waiting.length}</span>
        </div>
        ${
          waiting.length === 0
            ? `<div class="empty" data-i18n="emptyWaiting">No guests waiting</div>`
            : `<ul>${waiting
                .map((t) =>
                  ticketCard(
                    t,
                    action(t.id, "READY", "markReady", "Mark ready", "btn-ready") +
                      action(t.id, "CANCELLED", "cancel", "Cancel", "btn-ghost"),
                    "waiting"
                  )
                )
                .join("")}</ul>`
        }
      </section>
      <section class="panel ready-col">
        <div class="panel-head">
          <h2 class="ready" data-i18n="readySection">Ready For Pickup Orders</h2>
          <span class="count">${ready.length}</span>
        </div>
        ${
          ready.length === 0
            ? `<div class="empty" data-i18n="emptyReady">Nothing ready yet</div>`
            : `<ul>${ready
                .map((t) =>
                  ticketCard(
                    t,
                    pingAction(t.id) +
                      action(t.id, "COMPLETED", "markPickedUp", "Picked up", "btn-done"),
                    "ready"
                  )
                )
                .join("")}</ul>`
        }
      </section>
    </div>
    <section class="panel assist-panel">
      <div class="panel-head">
        <h2 class="assist" data-i18n="assistanceSection">Waiter calls</h2>
        <span class="count">${assistance.length}</span>
      </div>
      ${
        assistance.length === 0
          ? `<div class="empty" data-i18n="emptyAssistance">No waiter calls</div>`
          : `<ul>${assistance
              .map((c) => {
                const cls = c.status === "OPEN" ? "card open" : "card";
                const acts =
                  (c.status === "OPEN"
                    ? assistAction(
                        c.id,
                        "ACKNOWLEDGED",
                        "assistanceAcknowledge",
                        "Acknowledge",
                        "btn-ghost"
                      )
                    : "") +
                  assistAction(c.id, "DONE", "assistanceDone", "Done", "btn-ready");
                return `<li class="${cls}">
                  <div class="card-body">
                    <div class="name">${esc(c.customerName)}</div>
                    <div class="meta">${ageLabel(c.updatedAt)} · #${esc(c.orderRef)}${c.comment ? ` · ${esc(c.comment)}` : ""}</div>
                  </div>
                  <div class="actions">${acts}</div>
                </li>`;
              })
              .join("")}</ul>`
      }
    </section>
  </main>
  <div class="footer">
    <a href="${refreshUrl}" id="refresh-link" data-i18n="refresh">Refresh now</a>
    ·
    <a href="${boardBase}?lock=1" data-i18n="lock">Lock</a>
  </div>
  <script>
(function () {
  var REFRESH_URL = ${JSON.stringify(refreshUrl)};
  var OPEN_CALLS = ${openCallsJson};
  var SEEN_KEY = "qiktik_assist_seen:${esc(venueSlug)}";
  var SOUND_KEY = "qiktik_sound_on:${esc(venueSlug)}";
  var audioCtx = null;
  var soundReady = false;
  var alertEl = document.getElementById("call-alert");
  var soundBanner = document.getElementById("sound-banner");
  var alertVisible = false;

  function soundWasEnabled() {
    try { return localStorage.getItem(SOUND_KEY) === "1"; } catch (e) { return false; }
  }
  function markSoundEnabled() {
    soundReady = true;
    try { localStorage.setItem(SOUND_KEY, "1"); } catch (e) {}
    if (soundBanner) soundBanner.classList.remove("show");
  }
  function showSoundBannerIfNeeded() {
    if (!soundBanner) return;
    if (soundReady || soundWasEnabled()) {
      soundBanner.classList.remove("show");
      return;
    }
    soundBanner.classList.add("show");
  }

  function seenSet() {
    try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]"); } catch (e) { return []; }
  }
  function markSeen(id) {
    var s = seenSet();
    if (s.indexOf(id) === -1) s.push(id);
    try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(s.slice(-40))); } catch (e) {}
  }
  function wasSeen(id) { return seenSet().indexOf(id) !== -1; }

  // Prefer ambient/transient so iPad music mixes (or ducks briefly) instead of
  // being paused by HTMLAudioElement "playback" / a forever keep-alive tone.
  function preferMixableSession() {
    try {
      if (navigator.audioSession && typeof navigator.audioSession.type === "string") {
        navigator.audioSession.type = "ambient";
      }
    } catch (e) {}
  }

  function primeSound(fromGesture) {
    try {
      preferMixableSession();
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        if (!audioCtx || audioCtx.state === "closed") {
          audioCtx = new AC();
        }
        if (audioCtx.state === "suspended") audioCtx.resume();
      }
      if (fromGesture || (audioCtx && audioCtx.state === "running")) markSoundEnabled();
    } catch (e) {}
  }

  function playBeep() {
    preferMixableSession();
    try {
      if (!audioCtx) return;
      if (audioCtx.state === "suspended") {
        audioCtx.resume().then(function () { beepNow(); }).catch(function () {});
        return;
      }
      beepNow();
    } catch (e) {}
  }

  function beepNow() {
    try {
      if (!audioCtx) return;
      var now = audioCtx.currentTime;
      var tones = [880, 1175, 880];
      for (var i = 0; i < tones.length; i++) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.value = tones[i];
        var t0 = now + i * 0.2;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.18);
      }
      if (navigator.vibrate) navigator.vibrate([180, 80, 180, 80, 320]);
    } catch (e) {}
  }

  function pickupMsgs() {
    try {
      var loc = (window.__qiktikGetLocale && window.__qiktikGetLocale()) || "ar";
      return (window.__qiktikPickupMsgs && window.__qiktikPickupMsgs(loc)) || null;
    } catch (e) { return null; }
  }
  function showAlert(call, force) {
    if (!call || !call.id) return;
    if (!force && wasSeen(call.id)) return;
    markSeen(call.id);
    var isBill = call.reason === "BILL" || call.kind === "BILL" || /^Bill requested/i.test((call.comment || "").trim());
    var t = pickupMsgs();
    var badgeEl = document.getElementById("call-alert-badge");
    var titleEl = document.getElementById("call-alert-title");
    if (badgeEl) {
      badgeEl.setAttribute("data-i18n", isBill ? "askBillTitle" : "callWaiterTitle");
      badgeEl.textContent = isBill
        ? ((t && t.askBillTitle) || "Ask for the bill")
        : ((t && t.callWaiterTitle) || "Call a waiter");
    }
    if (titleEl) {
      titleEl.setAttribute("data-i18n", isBill ? "askBillBadge" : "callWaiterBadge");
      titleEl.textContent = isBill
        ? ((t && t.askBillBadge) || "Guest asked for the bill")
        : ((t && t.callWaiterBadge) || "Guest needs help");
    }
    document.getElementById("call-alert-name").textContent = call.customerName || "—";
    document.getElementById("call-alert-ref").textContent = call.orderRef ? ("#" + call.orderRef) : "—";
    var wrap = document.getElementById("call-alert-comment-wrap");
    var comment = (call.comment || "").trim();
    if (comment) {
      wrap.style.display = "block";
      document.getElementById("call-alert-comment").textContent = comment;
    } else {
      wrap.style.display = "none";
    }
    alertEl.classList.add("show");
    alertVisible = true;
    playBeep();
  }

  function hideAlert() {
    alertEl.classList.remove("show");
    alertVisible = false;
  }

  document.getElementById("call-alert-btn").addEventListener("click", function (e) {
    e.preventDefault();
    hideAlert();
  });
  alertEl.addEventListener("click", function (e) {
    if (e.target === alertEl) hideAlert();
  });

  showSoundBannerIfNeeded();
  if (soundBanner) {
    soundBanner.addEventListener("click", function () {
      primeSound(true);
      playBeep();
    });
  }
  // Any tap re-unlocks audio after iOS suspend — no need to show the banner again
  document.addEventListener("pointerdown", function () {
    primeSound(true);
  }, true);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      primeSound(false);
    }
  });

  for (var i = 0; i < OPEN_CALLS.length; i++) {
    showAlert(OPEN_CALLS[i]);
    break;
  }

  var BOARD_BASE = ${JSON.stringify(boardBase)};
  var LOGIN_HREF = BOARD_BASE + "?lock=1";

  function isStaffLoginHtml(doc) {
    return !!(
      doc.querySelector('input[name="password"]') ||
      (doc.title && /unlock/i.test(doc.title))
    );
  }

  function goToStaffLogin() {
    try {
      window.location.replace(LOGIN_HREF);
    } catch (e) {
      window.location.href = LOGIN_HREF;
    }
  }

  // Update queue HTML without full reload (full reload kills iOS AudioContext).
  // Also surface new waiter calls here — Vercel SSE is per-instance, so soft
  // refresh is the reliable path for the red full-screen alert in production.
  function softRefresh() {
    fetch(REFRESH_URL, { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        // Session locked/expired — login page has no board <main>; redirect fully.
        if (isStaffLoginHtml(doc) || !doc.querySelector("main")) {
          goToStaffLogin();
          return;
        }
        var newMain = doc.querySelector("main");
        var curMain = document.querySelector("main");
        var dataEl = doc.getElementById("open-calls-data");
        var newCalls = [];
        if (dataEl) {
          try { newCalls = JSON.parse(dataEl.textContent || "[]"); } catch (e) { newCalls = []; }
        }
        if (newMain && curMain && !alertVisible) {
          curMain.innerHTML = newMain.innerHTML;
          if (typeof window.__qiktikApplyLocale === "function") {
            window.__qiktikApplyLocale(window.__qiktikLocale || (typeof window.__qiktikGetLocale === "function" ? window.__qiktikGetLocale() : "ar"));
          }
        }
        if (!alertVisible) {
          for (var i = 0; i < newCalls.length; i++) {
            if (newCalls[i] && newCalls[i].id && !wasSeen(newCalls[i].id)) {
              showAlert(newCalls[i]);
              break;
            }
          }
        }
      })
      .catch(function () {});
  }

  // Staff buttons used to POST+redirect (full reload) — that resets iOS sound unlock every time.
  // Submit via fetch instead so audio stays enabled after one tap.
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;
    if (form.querySelector('input[name="password"]')) return;
    e.preventDefault();
    primeSound(true);
    var fd = new FormData(form);
    var postUrl = form.getAttribute("action") || window.location.pathname + window.location.search;
    if (!postUrl) postUrl = window.location.pathname;
    fetch(postUrl, {
      method: "POST",
      body: fd,
      credentials: "same-origin",
      redirect: "follow"
    })
      .then(function (r) {
        return r.text().then(function (html) {
          var doc = new DOMParser().parseFromString(html, "text/html");
          if (!r.ok || isStaffLoginHtml(doc) || !doc.querySelector("main")) {
            goToStaffLogin();
            return;
          }
          hideAlert();
          softRefresh();
        });
      })
      .catch(function () {
        form.submit();
      });
  }, true);

  var refreshLink = document.getElementById("refresh-link");
  if (refreshLink) {
    refreshLink.addEventListener("click", function (e) {
      e.preventDefault();
      softRefresh();
    });
  }

  function connectSSE() {
    try {
      var es = new EventSource("/api/v1/events");
      es.addEventListener("pickup:call-waiter", function (ev) {
        try {
          var data = JSON.parse(ev.data);
          showAlert({
            id: data.id,
            customerName: data.customerName,
            orderRef: data.orderRef,
            comment: data.comment
          }, true);
        } catch (e) {}
      });
      es.addEventListener("pickup:assistance-updated", function (ev) {
        try {
          var data = JSON.parse(ev.data);
          if (data && data.status === "OPEN") showAlert(data, true);
          softRefresh();
        } catch (e) {}
      });
      es.addEventListener("pickup:updated", function () { softRefresh(); });
      es.onerror = function () {
        es.close();
        setTimeout(connectSSE, 3000);
      };
    } catch (e) {}
  }
  connectSSE();
  setInterval(softRefresh, 2000);
})();
  </script>
  ${MOBILE_PULL_REFRESH_SCRIPT}
  ${poweredByQikTikHtml()}
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const wantLock = req.nextUrl.searchParams.get("lock") === "1";
  const slug = venueSlugFromReq(req);
  const venue =
    (await prisma.venue.findUnique({ where: { slug } })) ||
    (await prisma.venue.findFirst({ orderBy: { createdAt: "asc" } }));
  const token = wantLock
    ? null
    : tokenFromQueryOrForm(req, undefined, venue?.id);
  const logoSrc = venueLogoSrc(brandFromVenue(venue));
  const venueName = venue?.name || "Staff";

  if (!token) {
    const res = new NextResponse(renderLogin(slug, undefined, logoSrc, venueName), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
    res.cookies.set(VENUE_SLUG_COOKIE, slug, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return clearStaffCookies(res);
  }

  try {
    const data = await loadBoard(slug);
    return new NextResponse(renderBoard(token, data), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const res = new NextResponse(
      renderLogin(slug, "Database error — try unlock again", logoSrc, venueName),
      {
        status: 500,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
    return clearStaffCookies(res);
  }
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") || "";
  let form: FormData | null = null;
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    form = await req.formData().catch(() => null);
  }

  const password = form ? String(form.get("password") ?? "") : "";
  const accessToken = form ? String(form.get("access_token") ?? "") : "";
  const ticketId = form ? String(form.get("ticket_id") ?? "") : "";
  const pingTicketId = form ? String(form.get("ping_ticket_id") ?? "") : "";
  const status = form ? String(form.get("status") ?? "") : "";
  const assistanceId = form ? String(form.get("assistance_id") ?? "") : "";
  const assistanceStatus = form ? String(form.get("assistance_status") ?? "") : "";
  const formVenue = form ? String(form.get("venue") ?? "") : "";
  const slug = venueSlugFromReq(req, formVenue);
  const venue =
    (await prisma.venue.findUnique({ where: { slug } })) ||
    (await prisma.venue.findFirst({ orderBy: { createdAt: "asc" } }));
  const logoSrc = venueLogoSrc(brandFromVenue(venue));
  const venueName = venue?.name || "Staff";

  // Unlock
  if (password) {
    let ok = false;
    if (venue?.id) {
      try {
        ok = await verifyStaffPassword(password, venue.id);
      } catch {
        ok = false;
      }
    }
    if (!ok) {
      const res = new NextResponse(
        renderLogin(slug, "Wrong staff password", logoSrc, venueName),
        {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
      return clearStaffCookies(res);
    }
    const token = createStaffSessionValue(venue!.id);
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host") ||
      req.nextUrl.host;
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    const dest = new URL(
      `/r/${slug}/pickup?access_token=${encodeURIComponent(token)}`,
      `${proto}://${host}`
    );
    const res = NextResponse.redirect(dest, 303);
    const cookieOpts = staffSessionCookieOptions();
    res.cookies.set("qiktik_staff", token, cookieOpts);
    res.cookies.set("qiktik_staff_token", token, {
      ...cookieOpts,
      httpOnly: false,
    });
    res.cookies.set(VENUE_SLUG_COOKIE, slug, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }

  const token = tokenFromQueryOrForm(req, accessToken, venue?.id);
  if (!token) {
    const res = new NextResponse(
      renderLogin(slug, "Session expired", logoSrc, venueName),
      {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      }
    );
    return clearStaffCookies(res);
  }

  try {
    if (pingTicketId) {
      const { publish, RealtimeEvents } = await import("@/lib/realtime");
      const existing = await prisma.pickupTicket.findUnique({
        where: { id: pingTicketId },
      });
      if (
        existing &&
        existing.status !== "COMPLETED" &&
        existing.status !== "CANCELLED"
      ) {
        // Touch row so guest poll can detect re-ping when SSE is on another instance.
        const ticket = await prisma.pickupTicket.update({
          where: { id: pingTicketId },
          data: { customerName: existing.customerName },
        });
        const payload = {
          id: ticket.id,
          customerName: ticket.customerName,
          status: ticket.status,
          orderRef: ticket.orderRef,
          at: new Date().toISOString(),
        };
        publish(RealtimeEvents.PICKUP_PING, payload);
        try {
          const { sendPickupWebPush } = await import("@/lib/web-push");
          await sendPickupWebPush({
            ticketId: ticket.id,
            customerName: ticket.customerName,
            kind: "ping",
          });
        } catch {
          /* ignore push failures */
        }
      }
    } else if (ticketId && ["READY", "COMPLETED", "CANCELLED", "WAITING"].includes(status)) {
      const { publish, RealtimeEvents } = await import("@/lib/realtime");
      const existing = await prisma.pickupTicket.findUnique({
        where: { id: ticketId },
      });
      if (!existing || (venue?.id && existing.venueId !== venue.id)) {
        /* wrong venue / missing — skip */
      } else {
      const ticket = await prisma.pickupTicket.update({
        where: { id: ticketId },
        data: {
          status: status as "READY" | "COMPLETED" | "CANCELLED" | "WAITING",
          readyAt:
            status === "READY"
              ? existing.readyAt ?? new Date()
              : status === "WAITING"
                ? null
                : existing.readyAt,
        },
      });
      publish(RealtimeEvents.PICKUP_UPDATED, {
        id: ticket.id,
        status: ticket.status,
        customerName: ticket.customerName,
        orderRef: ticket.orderRef,
        readyAt: ticket.readyAt?.toISOString() ?? null,
        createdAt: ticket.createdAt.toISOString(),
        updatedAt: ticket.updatedAt.toISOString(),
      });
      if (status === "READY") {
        try {
          const { sendPickupWebPush } = await import("@/lib/web-push");
          await sendPickupWebPush({
            ticketId: ticket.id,
            customerName: ticket.customerName,
            kind: "ready",
          });
        } catch {
          /* ignore push failures */
        }
      }
      }
    }

    if (assistanceId && ["ACKNOWLEDGED", "DONE"].includes(assistanceStatus)) {
      const { publish, RealtimeEvents } = await import("@/lib/realtime");
      const call = await prisma.pickupAssistanceCall.update({
        where: { id: assistanceId },
        data: { status: assistanceStatus as "ACKNOWLEDGED" | "DONE" },
      });
      publish(RealtimeEvents.PICKUP_ASSISTANCE_UPDATED, {
        id: call.id,
        venueId: call.venueId,
        status: call.status,
        customerName: call.customerName,
        orderRef: call.orderRef,
        comment: call.comment,
      });
      if (assistanceStatus === "ACKNOWLEDGED") {
        try {
          const { notifyGuestAssistanceAcknowledged } = await import(
            "@/lib/web-push"
          );
          await notifyGuestAssistanceAcknowledged(call);
        } catch {
          /* ignore push failures */
        }
      }
    }
  } catch {
    /* show board anyway */
  }

  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  const dest = new URL(
    `/r/${slug}/pickup?access_token=${encodeURIComponent(token)}`,
    `${proto}://${host}`
  );
  return NextResponse.redirect(dest, 303);
}
