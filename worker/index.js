/* eslint-disable no-restricted-globals */
/**
 * Custom service worker chunk merged by `@ducanh2912/next-pwa`.
 * Android Chrome: require valid JSON payload, icon, badge, and `event.waitUntil(showNotification(…))`.
 */
const DEFAULT_ICON = "/icon-192x192.png";
const DEFAULT_TITLE = "GS365Cash";

self.addEventListener("push", (event) => {
  console.log("[Service Worker] Push received.");

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error("Failed to parse push data", e);
      data = { title: "إشعار جديد", message: "لديك رسالة جديدة" };
    }
  }

  const title = (typeof data.title === "string" && data.title) || DEFAULT_TITLE;
  const bodyText =
    (typeof data.message === "string" && data.message) ||
    (typeof data.body === "string" && data.body) ||
    "تحديث جديد في حسابك";

  const pathOrUrl = data.link || data.url || "/";
  const options = {
    body: bodyText,
    icon: DEFAULT_ICON,
    badge: DEFAULT_ICON,
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    requireInteraction: true,
    data: { url: pathOrUrl, link: pathOrUrl },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification click received.");
  event.notification.close();

  const d = event.notification.data;
  let raw = "/";
  if (typeof d === "string" && d) {
    raw = d;
  } else if (d && typeof d === "object") {
    raw = d.url || d.link || "/";
  }

  let href;
  try {
    href = new URL(raw, self.location.origin).href;
  } catch {
    href = `${self.location.origin}/`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === href && "focus" in client) {
          return client.focus();
        }
      }
      for (const client of clientList) {
        try {
          if (new URL(client.url).pathname === new URL(href).pathname && "focus" in client) {
            return client.focus();
          }
        } catch {
          // ignore
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(href);
      }
      return undefined;
    }),
  );
});
