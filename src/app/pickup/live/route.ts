import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  createStaffSessionValue,
  demoStaffPassword,
  verifyStaffPassword,
  verifyStaffSessionValue,
} from "@/lib/staff-auth";
import { DEFAULT_VENUE_SLUG } from "@/lib/venue-config";

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

/** Active board session = access_token in the URL/form only (cookies alone never auto-unlock). */
function tokenFromQueryOrForm(req: NextRequest, formToken?: string): string | null {
  const q = formToken || req.nextUrl.searchParams.get("access_token");
  if (q && verifyStaffSessionValue(q)) return q;
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
  if (!venue) return { venue: null, waiting: [], ready: [], assistance: [] };

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
  return { venue, waiting, ready, assistance };
}

function renderLogin(error?: string) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Pickup board — unlock</title>
  <style>
    body{margin:0;min-height:100vh;background:#101012;color:#eef2ef;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;display:flex;align-items:center;justify-content:center;padding:24px}
    .card{width:100%;max-width:420px;background:#1a1f18;border:1px solid rgba(255,255,255,.15);border-radius:16px;padding:24px}
    h1{margin:8px 0 0;font-size:24px}
    p{color:#c8c4bb;font-size:14px}
    label{display:block;font-size:12px;font-weight:600;color:#c8c4bb;margin-top:16px}
    input{width:100%;box-sizing:border-box;margin-top:8px;padding:14px 12px;border-radius:12px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#f2efe8;font-size:16px}
    button{width:100%;margin-top:16px;min-height:52px;border:0;border-radius:12px;padding:14px;font-size:16px;font-weight:700;background:linear-gradient(135deg,#f97316,#c2410c);color:#0c100e}
    .err{margin-top:12px;padding:10px 12px;border-radius:12px;border:1px solid rgba(212,114,114,.4);background:rgba(212,114,114,.12);color:#f0a0a0;font-size:14px}
    .badge{font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#f97316;font-weight:600}
  </style>
</head>
<body>
  <form class="card" method="POST" action="/pickup/live">
    <div class="badge">Staff</div>
    <h1>Pickup board</h1>
    <p>Enter the staff password to open this board.</p>
    ${error ? `<div class="err">${esc(error)}</div>` : ""}
    <label for="password">Staff password</label>
    <input id="password" name="password" type="password" required autocomplete="off" />
    <button type="submit">Unlock</button>
  </form>
</body>
</html>`;
}

function renderBoard(
  token: string,
  data: Awaited<ReturnType<typeof loadBoard>>
) {
  const refreshUrl = `/pickup/live?access_token=${encodeURIComponent(token)}`;
  const { waiting, ready, assistance, venue } = data;

  const ticketCard = (
    t: {
      id: string;
      customerName: string;
      orderRef: string | null;
      phone: string | null;
      createdAt: Date;
      status: string;
    },
    actions: string
  ) => `
    <li class="card">
      <div>
        <div class="name">${esc(t.customerName)}</div>
        <div class="meta">${ageLabel(t.createdAt)}${t.orderRef ? ` · #${esc(t.orderRef)}` : ""}${t.phone ? ` · ${esc(t.phone)}` : ""}</div>
      </div>
      <div class="actions">${actions}</div>
    </li>`;

  const action = (id: string, status: string, label: string, cls: string) => `
    <form method="POST" action="/pickup/live">
      <input type="hidden" name="access_token" value="${esc(token)}" />
      <input type="hidden" name="ticket_id" value="${esc(id)}" />
      <input type="hidden" name="status" value="${esc(status)}" />
      <button class="${cls}" type="submit">${esc(label)}</button>
    </form>`;

  const assistAction = (id: string, status: string, label: string, cls: string) => `
    <form method="POST" action="/pickup/live">
      <input type="hidden" name="access_token" value="${esc(token)}" />
      <input type="hidden" name="assistance_id" value="${esc(id)}" />
      <input type="hidden" name="assistance_status" value="${esc(status)}" />
      <button class="${cls}" type="submit">${esc(label)}</button>
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
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>Pickup queue — ${esc(venue?.name || "QikTik")}</title>
  <style>
    body{margin:0;background:#101012;color:#eef2ef;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    header{padding:16px;border-bottom:1px solid rgba(255,255,255,.08);background:#0c110f}
    .eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#f97316;opacity:.85}
    h1{margin:4px 0 0;font-size:28px}
    .hint{margin:6px 0 0;color:rgba(200,196,187,.55);font-size:14px}
    main{max-width:720px;margin:0 auto;padding:16px;display:grid;gap:24px}
    h2{margin:0 0 12px;font-size:13px;letter-spacing:.16em;text-transform:uppercase;color:#f97316}
    h2.ready{color:#5fad86}
    h2.assist{color:#d47272}
    ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
    .card{display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center;padding:16px;border-radius:16px;background:rgba(26,26,30,.92);border:1px solid rgba(255,255,255,.08)}
    .card.ready{border-color:rgba(95,173,134,.35);background:rgba(95,173,134,.12)}
    .card.open{border-color:rgba(212,114,114,.35);background:rgba(212,114,114,.12)}
    .name{font-size:18px;font-weight:600}
    .meta{margin-top:4px;font-size:12px;color:rgba(200,196,187,.55)}
    .actions{display:flex;flex-wrap:wrap;gap:8px}
    button{border:0;border-radius:12px;padding:10px 14px;font-size:14px;font-weight:700}
    .btn-ready{background:#3d8f68;color:#fff}
    .btn-done{background:#f97316;color:#0c100e}
    .btn-ghost{background:rgba(255,255,255,.06);color:rgba(238,242,239,.75);border:1px solid rgba(255,255,255,.1)}
    .empty{padding:32px 16px;text-align:center;border-radius:16px;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.03);color:rgba(200,196,187,.45);font-size:14px}
    .footer{padding:12px 16px;text-align:center;font-size:12px;color:rgba(200,196,187,.4)}
    a{color:#f97316}
    #sound-banner{display:none;margin:12px 16px 0;padding:12px 14px;border-radius:12px;border:1px solid rgba(249,115,22,.45);background:rgba(249,115,22,.14);color:#f97316;font-size:14px;font-weight:600;text-align:center;cursor:pointer}
    #sound-banner.show{display:block}
    #call-alert{display:none;position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;height:100dvh;z-index:9999;place-items:center;padding:max(24px,env(safe-area-inset-top)) max(24px,env(safe-area-inset-right)) max(24px,env(safe-area-inset-bottom)) max(24px,env(safe-area-inset-left));box-sizing:border-box;background:rgba(12,40,28,.82);animation:bgpulse .7s ease-in-out infinite;-webkit-transform:translateZ(0);transform:translateZ(0)}
    #call-alert.show{display:grid}
    #call-alert .panel{-webkit-appearance:none;appearance:none;display:block;width:min(520px,100%);max-width:520px;margin:0;border:4px solid #fecaca;border-radius:24px;background:#b91c1c;padding:40px 24px;text-align:center;box-shadow:0 0 60px rgba(220,38,38,.55);animation:flash .7s ease-in-out infinite;color:#fff;font:inherit}
    #call-alert .badge{font-size:13px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;color:#fee2e2}
    #call-alert h2{margin:16px 0 0;font-size:clamp(28px,6vw,40px);font-weight:800;line-height:1.1;color:#fff;letter-spacing:normal;text-transform:none}
    #call-alert .box{margin-top:12px;border-radius:16px;background:rgba(0,0,0,.2);padding:12px 16px;text-align:start}
    #call-alert .box dt{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:#fecaca;opacity:.9}
    #call-alert .box dd{margin:4px 0 0;font-size:clamp(20px,5vw,28px);font-weight:800}
    #call-alert .tap{margin-top:28px;font-size:13px;letter-spacing:.18em;text-transform:uppercase;color:#fecaca;opacity:.9}
    @keyframes flash{0%,100%{opacity:1}50%{opacity:.72}}
    @keyframes bgpulse{0%,100%{background-color:rgba(12,40,28,.82)}50%{background-color:rgba(20,90,55,.9)}}
  </style>
</head>
<body>
  <div id="sound-banner">Tap here to enable call-waiter sound + alerts</div>
  <div id="call-alert" role="alertdialog" aria-modal="true">
    <button type="button" class="panel" id="call-alert-btn">
      <div class="badge">Call waiter</div>
      <h2 id="call-alert-title">Guest needs help</h2>
      <dl>
        <div class="box"><dt>Name</dt><dd id="call-alert-name">—</dd></div>
        <div class="box"><dt>Ticket</dt><dd id="call-alert-ref">—</dd></div>
        <div class="box" id="call-alert-comment-wrap" style="display:none"><dt>Comment</dt><dd id="call-alert-comment"></dd></div>
      </dl>
      <div class="tap">Tap to dismiss</div>
    </button>
  </div>
  <header>
    <div class="eyebrow">Floor</div>
    <h1>Pickup queue</h1>
    <p class="hint">${esc(venue?.name || "My Restaurant")} · live alerts + auto-refresh</p>
  </header>
  <main>
    <section>
      <h2>Waiting orders (${waiting.length})</h2>
      ${
        waiting.length === 0
          ? `<div class="empty">No guests waiting</div>`
          : `<ul>${waiting
              .map((t) =>
                ticketCard(
                  t,
                  action(t.id, "READY", "Mark ready", "btn-ready") +
                    action(t.id, "CANCELLED", "Cancel", "btn-ghost")
                )
              )
              .join("")}</ul>`
      }
    </section>
    <section>
      <h2 class="ready">Ready for pickup (${ready.length})</h2>
      ${
        ready.length === 0
          ? `<div class="empty">No ready orders</div>`
          : `<ul>${ready
              .map((t) =>
                ticketCard(
                  t,
                  action(t.id, "COMPLETED", "Picked up", "btn-done")
                )
              )
              .join("")}</ul>`
      }
    </section>
    <section>
      <h2 class="assist">Waiter calls (${assistance.length})</h2>
      ${
        assistance.length === 0
          ? `<div class="empty">No waiter calls</div>`
          : `<ul>${assistance
              .map((c) => {
                const cls = c.status === "OPEN" ? "card open" : "card";
                const acts =
                  (c.status === "OPEN"
                    ? assistAction(c.id, "ACKNOWLEDGED", "Acknowledge", "btn-ghost")
                    : "") +
                  assistAction(c.id, "DONE", "Done", "btn-ready");
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
    <a href="${refreshUrl}">Refresh now</a>
    ·
    <a href="/pickup/live?lock=1">Lock</a>
  </div>
  <audio id="alert-audio" preload="auto" playsinline></audio>
  <script>
(function () {
  var REFRESH_URL = ${JSON.stringify(refreshUrl)};
  var OPEN_CALLS = ${openCallsJson};
  var SEEN_KEY = "qiktik_assist_seen";
  var SOUND_KEY = "qiktik_sound_on";
  var audioCtx = null;
  var keepAliveOsc = null;
  var keepAliveGain = null;
  var soundReady = false;
  var alertEl = document.getElementById("call-alert");
  var soundBanner = document.getElementById("sound-banner");
  var alertAudio = document.getElementById("alert-audio");
  var alertVisible = false;

  // Tiny WAV beep (unlocked via HTMLAudioElement — more reliable on iOS after gesture)
  alertAudio.src = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQAAAAA=";

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

  function keepAudioAlive() {
    try {
      if (!audioCtx) return;
      if (audioCtx.state === "suspended") audioCtx.resume();
      if (keepAliveOsc) return;
      keepAliveOsc = audioCtx.createOscillator();
      keepAliveGain = audioCtx.createGain();
      keepAliveGain.gain.value = 0.00001;
      keepAliveOsc.frequency.value = 40;
      keepAliveOsc.connect(keepAliveGain);
      keepAliveGain.connect(audioCtx.destination);
      keepAliveOsc.start();
    } catch (e) {}
  }

  function primeSound(fromGesture) {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        if (!audioCtx || audioCtx.state === "closed") {
          audioCtx = new AC();
          keepAliveOsc = null;
          keepAliveGain = null;
        }
        if (audioCtx.state === "suspended") audioCtx.resume();
        keepAudioAlive();
      }
      // Unlock HTMLAudioElement during the same gesture
      if (fromGesture) {
        alertAudio.muted = true;
        var p = alertAudio.play();
        if (p && p.then) {
          p.then(function () {
            alertAudio.pause();
            alertAudio.currentTime = 0;
            alertAudio.muted = false;
          }).catch(function () {});
        }
      }
      if (fromGesture || (audioCtx && audioCtx.state === "running")) markSoundEnabled();
    } catch (e) {}
  }

  function playBeep() {
    try {
      if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().then(function () { keepAudioAlive(); beepNow(); }).catch(function () { beepHtml(); });
        return;
      }
      beepNow();
      beepHtml();
    } catch (e) {
      beepHtml();
    }
  }

  function beepNow() {
    try {
      if (!audioCtx) return;
      keepAudioAlive();
      var now = audioCtx.currentTime;
      var tones = [880, 1175, 880];
      for (var i = 0; i < tones.length; i++) {
        var osc = audioCtx.createOscillator();
        var gain = audioCtx.createGain();
        osc.type = "square";
        osc.frequency.value = tones[i];
        var t0 = now + i * 0.2;
        gain.gain.setValueAtTime(0.0001, t0);
        gain.gain.exponentialRampToValueAtTime(0.32, t0 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start(t0);
        osc.stop(t0 + 0.18);
      }
      if (navigator.vibrate) navigator.vibrate([180, 80, 180, 80, 320]);
    } catch (e) {}
  }

  function beepHtml() {
    try {
      alertAudio.muted = false;
      alertAudio.currentTime = 0;
      var p = alertAudio.play();
      if (p && p.catch) p.catch(function () {});
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
      keepAudioAlive();
    }
  });

  for (var i = 0; i < OPEN_CALLS.length; i++) {
    showAlert(OPEN_CALLS[i]);
    break;
  }

  // Update queue HTML without full reload (full reload kills iOS AudioContext)
  function softRefresh() {
    if (alertVisible) return;
    fetch(REFRESH_URL, { credentials: "same-origin", cache: "no-store" })
      .then(function (r) { return r.text(); })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, "text/html");
        var newMain = doc.querySelector("main");
        var curMain = document.querySelector("main");
        if (newMain && curMain) curMain.innerHTML = newMain.innerHTML;
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
    fetch("/pickup/live", {
      method: "POST",
      body: fd,
      credentials: "same-origin",
      redirect: "manual"
    })
      .then(function () {
        hideAlert();
        softRefresh();
        keepAudioAlive();
      })
      .catch(function () {
        form.submit();
      });
  }, true);

  var refreshLink = document.querySelector('.footer a[href*="/pickup/live"]');
  if (refreshLink && /Refresh/i.test(refreshLink.textContent || "")) {
    refreshLink.addEventListener("click", function (e) {
      e.preventDefault();
      softRefresh();
      keepAudioAlive();
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
  setInterval(softRefresh, 4000);
})();
  </script>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  const wantLock = req.nextUrl.searchParams.get("lock") === "1";
  const token = wantLock ? null : tokenFromQueryOrForm(req);

  if (!token) {
    const res = new NextResponse(renderLogin(), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
    return clearStaffCookies(res);
  }

  try {
    const data = await loadBoard(DEFAULT_VENUE_SLUG);
    return new NextResponse(renderBoard(token, data), {
      headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" },
    });
  } catch (e) {
    const res = new NextResponse(
      renderLogin("Database error — try unlock again"),
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
  const status = form ? String(form.get("status") ?? "") : "";
  const assistanceId = form ? String(form.get("assistance_id") ?? "") : "";
  const assistanceStatus = form ? String(form.get("assistance_status") ?? "") : "";

  // Unlock
  if (password) {
    let ok = false;
    try {
      ok = await verifyStaffPassword(password);
    } catch {
      ok = password.trim() === demoStaffPassword();
    }
    if (!ok) {
      const res = new NextResponse(renderLogin("Wrong staff password"), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
      return clearStaffCookies(res);
    }
    const token = createStaffSessionValue();
    const host =
      req.headers.get("x-forwarded-host")?.split(",")[0]?.trim() ||
      req.headers.get("host") ||
      req.nextUrl.host;
    const proto =
      req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    const dest = new URL(`/pickup/live?access_token=${encodeURIComponent(token)}`, `${proto}://${host}`);
    const res = NextResponse.redirect(dest, 303);
    res.cookies.set("qiktik_staff", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    res.cookies.set("qiktik_staff_token", token, {
      httpOnly: false,
      sameSite: "lax",
      secure: false,
      path: "/",
      maxAge: 12 * 60 * 60,
    });
    return res;
  }

  const token = tokenFromQueryOrForm(req, accessToken);
  if (!token) {
    const res = new NextResponse(renderLogin("Session expired"), {
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
    return clearStaffCookies(res);
  }

  try {
    if (ticketId && ["READY", "COMPLETED", "CANCELLED", "WAITING"].includes(status)) {
      const { publish, RealtimeEvents } = await import("@/lib/realtime");
      const ticket = await prisma.pickupTicket.update({
        where: { id: ticketId },
        data: {
          status: status as "READY" | "COMPLETED" | "CANCELLED" | "WAITING",
          readyAt: status === "READY" ? new Date() : undefined,
        },
      });
      publish(RealtimeEvents.PICKUP_UPDATED, {
        id: ticket.id,
        status: ticket.status,
        customerName: ticket.customerName,
        orderRef: ticket.orderRef,
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

    if (assistanceId && ["ACKNOWLEDGED", "DONE"].includes(assistanceStatus)) {
      const { publish, RealtimeEvents } = await import("@/lib/realtime");
      const call = await prisma.pickupAssistanceCall.update({
        where: { id: assistanceId },
        data: { status: assistanceStatus as "ACKNOWLEDGED" | "DONE" },
      });
      publish(RealtimeEvents.PICKUP_ASSISTANCE_UPDATED, {
        id: call.id,
        status: call.status,
        customerName: call.customerName,
        orderRef: call.orderRef,
      });
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
    `/pickup/live?access_token=${encodeURIComponent(token)}`,
    `${proto}://${host}`
  );
  return NextResponse.redirect(dest, 303);
}
