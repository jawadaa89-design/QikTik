import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createStaffSessionValue,
  parseStaffSession,
  staffSessionCookieOptions,
  verifyStaffPassword,
} from "@/lib/staff-auth";
import { hasFeature } from "@/lib/features";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";
import { VENUE_SLUG_COOKIE, VENUE_SLUG_HEADER } from "@/lib/venue-paths";
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
import {
  STAFF_LOCALE_KEY,
  isRtl,
  localeNames,
  locales,
  pickupMessages,
  staffGateMessages,
} from "@/i18n/staff";
import { poweredByQikTikHtml } from "@/components/PoweredByQikTik";

/** Menu+alerts+pickup → combined board (waiter calls + pickup queues). */
async function combinedBoardPath(venueId: string | undefined): Promise<string> {
  if (venueId && (await hasFeature("pickup", venueId))) return "/pickup/live";
  return "/alerts/live";
}

function requestOrigin(req: NextRequest): string {
  const host =
    req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
    req.headers.get("host") ||
    req.nextUrl.host;
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
  return `${proto}://${host}`;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LOCALE_JSON = JSON.stringify({
  key: STAFF_LOCALE_KEY,
  locales,
  names: localeNames,
  rtl: Object.fromEntries(locales.map((l) => [l, isRtl(l)])),
  pickup: pickupMessages,
  gate: staffGateMessages,
});

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

async function loadCalls(venueSlug: string) {
  const venue =
    (await prisma.venue.findUnique({ where: { slug: venueSlug } })) ||
    (await prisma.venue.findFirst({ orderBy: { createdAt: "asc" } }));
  if (!venue)
    return {
      venue: null,
      brand: brandFromVenue(null),
      assistance: [] as Awaited<
        ReturnType<typeof prisma.pickupAssistanceCall.findMany>
      >,
    };

  const assistance = await prisma.pickupAssistanceCall.findMany({
    where: { venueId: venue.id, status: { in: ["OPEN", "ACKNOWLEDGED"] } },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
  });
  return { venue, brand: brandFromVenue(venue), assistance };
}

function langSelectHtml() {
  const opts = locales
    .map((l) => `<option value="${l}">${esc(localeNames[l])}</option>`)
    .join("");
  return `<label class="lang">
    <span class="sr-only" data-i18n="language">Language</span>
    <select id="staff-lang" aria-label="Language" data-i18n-aria="language">${opts}</select>
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
    var hint = document.getElementById("board-hint");
    if (hint && MODE === "board") {
      var venue = hint.getAttribute("data-venue") || "";
      var pt = CFG.pickup[loc] || CFG.pickup.en;
      hint.textContent = venue ? (venue + " · " + pt.liveSuffix) : pt.liveSuffix;
    }
    var sel = document.getElementById("staff-lang");
    if (sel && sel.value !== loc) sel.value = loc;
    window.__qiktikApplyLocale = apply;
    window.__qiktikLocale = loc;
  }
  document.addEventListener("DOMContentLoaded", function () {
    var loc = stored();
    apply(loc);
    var sel = document.getElementById("staff-lang");
    if (sel) {
      sel.value = loc;
      sel.addEventListener("change", function () { apply(sel.value); });
    }
  });
  window.__qiktikApplyLocale = apply;
  window.__qiktikGetLocale = stored;
})();
</script>`;
}

function renderLogin(
  venueSlug: string,
  error?: string,
  logoSrc = "/logo.png",
  venueName = "Staff"
) {
  const boardPath = `/r/${esc(venueSlug)}/alerts`;
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>${esc(venueName)} · Alerts unlock</title>
  ${venueFaviconLinkTags(logoSrc)}
  <style>
    body{margin:0;min-height:100vh;background:#101012;color:#eef2ef;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:100%;max-width:420px;background:#1a1f18;border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:24px}
    .top{display:flex;justify-content:space-between;align-items:center;gap:12px}
    .brand{display:flex;align-items:center;gap:12px;margin-top:12px}
    .brand img{width:56px;height:56px;border-radius:999px;object-fit:cover;border:2px solid rgba(249,115,22,.4);background:#f6f3ee}
    h1{margin:0;font-size:24px}
    p{color:#c8c4bb;font-size:14px}
    label.field{display:block;font-size:12px;font-weight:600;color:#c8c4bb;margin-top:16px}
    input{width:100%;box-sizing:border-box;margin-top:8px;padding:14px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#f2efe8;font-size:16px}
    button{width:100%;margin-top:16px;min-height:52px;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:700;background:linear-gradient(135deg,#f97316,#c2410c);color:#0c100e}
    .err{margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid rgba(212,114,114,.4);background:rgba(212,114,114,.12);color:#f0a0a0;font-size:14px}
    .badge{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#f97316;font-weight:600}
    .lang select{appearance:none;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:#1a211c;color:#f2efe8;font-size:12px;font-weight:600;padding:8px 28px 8px 12px}
    .lang select option{background:#fff;color:#111}
    .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
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
  ${poweredByQikTikHtml()}
</body>
</html>`;
}

function renderBoard(
  token: string,
  data: Awaited<ReturnType<typeof loadCalls>>
) {
  const refreshUrl = `?access_token=${encodeURIComponent(token)}`;
  const { assistance, venue, brand } = data;
  const venueName = venue?.name || "My Restaurant";
  const venueSlug = venue?.slug || DEFAULT_VENUE_SLUG;
  const b = brand ?? brandFromVenue(venue);
  const logoSrc = venueLogoSrc(b);

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

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Alerts — ${esc(venueName)}</title>
  ${venueFaviconLinkTags(logoSrc)}
  <style>
    :root{--bg:${esc(b.backgroundColor)};--panel:${esc(b.surfaceColor)};--line:rgba(255,255,255,.08);--ink:${esc(b.textColor)};--muted:rgba(200,196,187,.55);--orange:${esc(b.accentColor)};--red:#d47272;--brand-accent:${esc(b.accentColor)};--brand-bg:${esc(b.backgroundColor)};--brand-surface:${esc(b.surfaceColor)};--brand-text:${esc(b.textColor)}}
    *{box-sizing:border-box}
    body{margin:0;min-height:100vh;color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:radial-gradient(ellipse 80% 50% at 10% -10%,color-mix(in srgb,var(--orange) 22%,transparent),transparent 55%),var(--bg)}
    header{padding:18px 20px 16px;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 78%,black)}
    .header-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
    .header-brand{display:flex;align-items:center;gap:22px;min-width:0}
    .header-brand img{width:56px;height:56px;border-radius:999px;object-fit:cover;border:2px solid color-mix(in srgb,var(--orange) 45%,transparent);background:#f6f3ee}
    .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--orange);font-weight:700}
    h1{margin:4px 0 0;font-size:clamp(22px,4vw,30px);font-weight:750}
    .hint{margin:8px 0 0;color:var(--muted);font-size:13px}
    main{max-width:720px;margin:0 auto;padding:18px 16px 28px}
    .panel{border-radius:20px;border:1px solid rgba(212,114,114,.28);background:var(--panel);padding:14px;box-shadow:0 12px 40px rgba(0,0,0,.22)}
    .panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;padding:2px 4px 10px;border-bottom:1px solid var(--line)}
    h2{margin:0;font-size:12px;letter-spacing:.16em;text-transform:uppercase;color:var(--red);font-weight:800}
    .count{min-width:28px;height:28px;padding:0 8px;border-radius:999px;display:inline-flex;align-items:center;justify-content:center;font-size:13px;font-weight:800;background:rgba(212,114,114,.2);color:#f3c0c0}
    ul{list-style:none;margin:0;padding:0;display:grid;gap:10px}
    .card{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center;padding:14px;border-radius:14px;background:rgba(255,255,255,.035);border:1px solid rgba(255,255,255,.07)}
    .card.open{border-inline-start:3px solid #ef4444;border-color:rgba(254,202,202,.9);background:rgba(185,28,28,.42);transition:none;-webkit-animation:alertPulse .7s ease-in-out infinite;animation:alertPulse .7s ease-in-out infinite}
    .name{font-size:17px;font-weight:700}
    .meta{margin-top:4px;font-size:12px;color:var(--muted)}
    .actions{display:flex;flex-wrap:wrap;gap:8px}
    button{border:0;border-radius:11px;padding:10px 14px;font-size:13px;font-weight:750;cursor:pointer;min-height:42px}
    .btn-ready{background:linear-gradient(135deg,#4aa87a,#2f7a56);color:#fff}
    .btn-ghost{background:rgba(255,255,255,.05);color:rgba(238,242,239,.8);border:1px solid rgba(255,255,255,.12)}
    .empty{padding:36px 16px;text-align:center;border-radius:14px;border:1px dashed rgba(255,255,255,.1);color:rgba(200,196,187,.42);font-size:14px}
    .footer{padding:8px 16px 24px;text-align:center;font-size:12px;color:rgba(200,196,187,.4)}
    a{color:var(--orange);text-decoration:none}
    .lang select{appearance:none;border-radius:12px;border:1px solid rgba(255,255,255,.2);background:#1a211c;color:#f2efe8;font-size:12px;font-weight:600;padding:8px 28px 8px 12px}
    .lang select option{background:#fff;color:#111}
    .sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
    #sound-banner{display:none;margin:12px 16px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(249,115,22,.45);background:rgba(249,115,22,.14);color:#f97316;font-size:14px;font-weight:600;text-align:center;cursor:pointer}
    #sound-banner.show{display:block}
    #call-alert{display:none;position:fixed;inset:0;z-index:9999;place-items:center;padding:24px;background:rgba(12,40,28,.82);animation:bgpulse .7s ease-in-out infinite}
    #call-alert.show{display:grid}
    #call-alert .panel{width:min(520px,100%);border:4px solid #fecaca;border-radius:24px;background:#b91c1c;padding:40px 24px;text-align:center;color:#fff;animation:flash .7s ease-in-out infinite;min-height:0}
    #call-alert .badge{font-size:13px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;color:#fee2e2}
    #call-alert h2{margin:16px 0 0;font-size:clamp(28px,6vw,40px);font-weight:800;color:#fff;letter-spacing:normal;text-transform:none}
    #call-alert .box{margin-top:12px;border-radius:16px;background:rgba(0,0,0,.2);padding:12px 16px;text-align:start}
    #call-alert .box dt{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#fecaca}
    #call-alert .box dd{margin:4px 0 0;font-size:clamp(20px,5vw,28px);font-weight:800}
    #call-alert .tap{margin-top:28px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#fecaca}
    @keyframes flash{0%,100%{opacity:1}50%{opacity:.72}}
    @keyframes bgpulse{0%,100%{background-color:rgba(12,40,28,.82)}50%{background-color:rgba(20,90,55,.9)}}
    @keyframes alertPulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.72;transform:scale(1.015)}}
    @-webkit-keyframes alertPulse{0%,100%{opacity:1;-webkit-transform:scale(1)}50%{opacity:.72;-webkit-transform:scale(1.015)}}
  </style>
  ${i18nBootScript("board")}
</head>
<body>
  <div id="sound-banner" data-i18n="soundEnable">Tap here to enable call-waiter sound + alerts</div>
  <div id="call-alert" role="alertdialog" aria-modal="true">
    <button type="button" class="panel" id="call-alert-btn">
      <div class="badge" data-i18n="callWaiterTitle">Call waiter</div>
      <h2 data-i18n="callWaiterBadge">Guest needs help</h2>
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
          <div class="eyebrow" data-i18n="assistanceSection">Waiter calls</div>
          <h1 data-i18n="callWaiterTitle">Call a waiter</h1>
        </div>
      </div>
      ${langSelectHtml()}
    </div>
    <p class="hint" id="board-hint" data-venue="${esc(venueName)}">${esc(venueName)} · live alerts</p>
  </header>
  <main>
    <script type="application/json" id="open-calls-data">${openCallsJson}</script>
    <section class="panel">
      <div class="panel-head">
        <h2 data-i18n="assistanceSection">Waiter calls</h2>
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
                    ? assistAction(c.id, "ACKNOWLEDGED", "assistanceAcknowledge", "Acknowledge", "btn-ghost")
                    : "") +
                  assistAction(c.id, "DONE", "assistanceDone", "Done", "btn-ready");
                return `<li class="${cls}">
                  <div>
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
    <a href="/r/${esc(venue?.slug || DEFAULT_VENUE_SLUG)}/alerts?lock=1" data-i18n="lock">Lock</a>
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

  function soundWasEnabled() { try { return localStorage.getItem(SOUND_KEY) === "1"; } catch (e) { return false; } }
  function markSoundEnabled() {
    soundReady = true;
    try { localStorage.setItem(SOUND_KEY, "1"); } catch (e) {}
    if (soundBanner) soundBanner.classList.remove("show");
  }
  function showSoundBannerIfNeeded() {
    if (!soundBanner) return;
    if (soundReady || soundWasEnabled()) soundBanner.classList.remove("show");
    else soundBanner.classList.add("show");
  }
  function seenSet() { try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) || "[]"); } catch (e) { return []; } }
  function markSeen(id) {
    var s = seenSet();
    if (s.indexOf(id) === -1) s.push(id);
    try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(s.slice(-40))); } catch (e) {}
  }
  function wasSeen(id) { return seenSet().indexOf(id) !== -1; }
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
        if (!audioCtx || audioCtx.state === "closed") audioCtx = new AC();
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
      [880, 1175, 880].forEach(function (freq, i) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.value = freq;
        var t0 = now + i * 0.2;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.start(t0); osc.stop(t0 + 0.18);
      });
      if (navigator.vibrate) navigator.vibrate([180, 80, 180, 80, 320]);
    } catch (e) {}
  }
  function showAlert(call, force) {
    if (!call || !call.id) return;
    if (!force && wasSeen(call.id)) return;
    markSeen(call.id);
    document.getElementById("call-alert-name").textContent = call.customerName || "—";
    document.getElementById("call-alert-ref").textContent = call.orderRef ? ("#" + call.orderRef) : "—";
    var wrap = document.getElementById("call-alert-comment-wrap");
    var comment = (call.comment || "").trim();
    if (comment) { wrap.style.display = "block"; document.getElementById("call-alert-comment").textContent = comment; }
    else wrap.style.display = "none";
    alertEl.classList.add("show");
    alertVisible = true;
    playBeep();
  }
  function hideAlert() { alertEl.classList.remove("show"); alertVisible = false; }
  document.getElementById("call-alert-btn").addEventListener("click", function (e) { e.preventDefault(); hideAlert(); });
  showSoundBannerIfNeeded();
  if (soundBanner) soundBanner.addEventListener("click", function () { primeSound(true); playBeep(); });
  document.addEventListener("pointerdown", function () { primeSound(true); }, true);
  for (var i = 0; i < OPEN_CALLS.length; i++) { showAlert(OPEN_CALLS[i]); break; }

  var BOARD_BASE = ${JSON.stringify(`/r/${venue?.slug || DEFAULT_VENUE_SLUG}/alerts`)};
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

  function softRefresh() {
    fetch(REFRESH_URL, { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
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
            window.__qiktikApplyLocale(window.__qiktikLocale || "ar");
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
      }).catch(function () {});
  }
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (!form || form.tagName !== "FORM") return;
    if (form.querySelector('input[name="password"]')) return;
    e.preventDefault();
    primeSound(true);
    var postUrl = form.getAttribute("action") || window.location.pathname + window.location.search;
    if (!postUrl) postUrl = window.location.pathname;
    fetch(postUrl, {
      method: "POST",
      body: new FormData(form),
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
      .catch(function () { form.submit(); });
  }, true);
  var refreshLink = document.getElementById("refresh-link");
  if (refreshLink) refreshLink.addEventListener("click", function (e) { e.preventDefault(); softRefresh(); });

  function connectSSE() {
    try {
      var es = new EventSource("/api/v1/events");
      es.addEventListener("pickup:call-waiter", function (ev) {
        try {
          var data = JSON.parse(ev.data);
          showAlert({ id: data.id, customerName: data.customerName, orderRef: data.orderRef, comment: data.comment }, true);
        } catch (e) {}
      });
      es.addEventListener("pickup:assistance-updated", function (ev) {
        try {
          var data = JSON.parse(ev.data);
          if (data && data.status === "OPEN") showAlert(data, true);
          softRefresh();
        } catch (e) {}
      });
      es.onerror = function () { es.close(); setTimeout(connectSSE, 3000); };
    } catch (e) {}
  }
  connectSSE();
  setInterval(softRefresh, 2000);
})();
  </script>
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
    const res = clearStaffCookies(
      new NextResponse(renderLogin(slug, undefined, logoSrc, venueName), {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
      })
    );
    res.cookies.set(VENUE_SLUG_COOKIE, slug, {
      path: "/",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  }
  try {
    const data = await loadCalls(slug);
    const boardPath = await combinedBoardPath(data.venue?.id);
    if (boardPath !== "/alerts/live") {
      const dest = new URL(
        `/r/${slug}/pickup?access_token=${encodeURIComponent(token)}`,
        requestOrigin(req)
      );
      return NextResponse.redirect(dest, 303);
    }
    return new NextResponse(renderBoard(token, data), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch {
    return clearStaffCookies(
      new NextResponse(
        renderLogin(slug, "Database error — try unlock again", logoSrc, venueName),
        {
          status: 500,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      )
    );
  }
}

export async function POST(req: NextRequest) {
  const form = await req.formData().catch(() => null);
  const password = form ? String(form.get("password") ?? "") : "";
  const accessToken = form ? String(form.get("access_token") ?? "") : "";
  const assistanceId = form ? String(form.get("assistance_id") ?? "") : "";
  const assistanceStatus = form ? String(form.get("assistance_status") ?? "") : "";
  const formVenue = form ? String(form.get("venue") ?? "") : "";
  const slug = venueSlugFromReq(req, formVenue);
  const venue =
    (await prisma.venue.findUnique({ where: { slug } })) ||
    (await prisma.venue.findFirst({ orderBy: { createdAt: "asc" } }));
  const logoSrc = venueLogoSrc(brandFromVenue(venue));
  const venueName = venue?.name || "Staff";

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
      return clearStaffCookies(
        new NextResponse(
          renderLogin(slug, "Wrong staff password", logoSrc, venueName),
          {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        )
      );
    }
    const token = createStaffSessionValue(venue!.id);
    const boardPath = await combinedBoardPath(venue?.id);
    const publicBoard =
      boardPath.includes("pickup") ? `/r/${slug}/pickup` : `/r/${slug}/alerts`;
    const dest = new URL(
      `${publicBoard}?access_token=${encodeURIComponent(token)}`,
      requestOrigin(req)
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
    return clearStaffCookies(
      new NextResponse(renderLogin(slug, "Session expired", logoSrc, venueName), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      })
    );
  }

  try {
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
          const { notifyGuestAssistanceAcknowledged } = await import("@/lib/web-push");
          await notifyGuestAssistanceAcknowledged(call);
        } catch {
          /* ignore */
        }
      }
    }
  } catch {
    /* show board anyway */
  }

  const boardPath = await combinedBoardPath(venue?.id);
  const publicBoard =
    boardPath.includes("pickup") ? `/r/${slug}/pickup` : `/r/${slug}/alerts`;
  return NextResponse.redirect(
    new URL(
      `${publicBoard}?access_token=${encodeURIComponent(token)}`,
      requestOrigin(req)
    ),
    303
  );
}
