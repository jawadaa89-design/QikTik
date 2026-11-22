/* QikTik guest pickup — Web Push service worker v5 */
/* global self, clients */

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("push", (event) => {
  // iOS requires a visible notification for every push (userVisibleOnly).
  // Always show a notification — never return early.
  // Keep showNotification inside waitUntil — do not await outside it.
  event.waitUntil(
    (async () => {
      let data = {
        title: "QikTik",
        body: "Your order update is ready.",
        url: "/ar/pickup",
        tag: "pickup-" + Date.now(),
        renotify: true,
        requireInteraction: true,
      };

      try {
        if (event.data) {
          const parsed = event.data.json();
          data = { ...data, ...parsed };
          // Prefer nested data.url (Apple-friendly payload shape).
          if (parsed && parsed.data && typeof parsed.data === "object") {
            if (parsed.data.url) data.url = parsed.data.url;
          }
        }
      } catch {
        try {
          const text = event.data && event.data.text();
          if (text) data.body = text;
        } catch {
          /* ignore */
        }
      }

      // Always resolve against this SW's origin (tunnel HTTPS or LAN) — never MENU_BASE_URL.
      let targetUrl = data.url || "/ar/pickup";
      try {
        targetUrl = new URL(targetUrl, self.location.origin).href;
      } catch {
        targetUrl = self.location.origin + "/ar/pickup";
      }

      const options = {
        body: data.body || "",
        // Unique tag per ping (from payload) so iOS shows each re-ping.
        tag: data.tag || "pickup-" + Date.now(),
        renotify: data.renotify !== false,
        requireInteraction: data.requireInteraction !== false,
        data: { url: targetUrl },
        vibrate: [200, 100, 200, 100, 400],
      };

      await self.registration.showNotification(data.title || "QikTik", options);
    })()
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  let targetUrl =
    (event.notification.data && event.notification.data.url) || "/ar/pickup";
  try {
    targetUrl = new URL(targetUrl, self.location.origin).href;
  } catch {
    targetUrl = self.location.origin + "/ar/pickup";
  }

  event.waitUntil(
    (async () => {
      const allClients = await clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of allClients) {
        try {
          const clientUrl = new URL(client.url);
          const want = new URL(targetUrl, self.location.origin);
          if (clientUrl.pathname === want.pathname && "focus" in client) {
            await client.focus();
            if ("navigate" in client && clientUrl.href !== want.href) {
              await client.navigate(want.href);
            }
            return;
          }
        } catch {
          /* continue */
        }
      }

      if (clients.openWindow) {
        await clients.openWindow(targetUrl);
      }
    })()
  );
});
