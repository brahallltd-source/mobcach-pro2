/* eslint-disable no-restricted-globals */
/**
 * Custom service worker chunk merged by `@ducanh2912/next-pwa`.
 * Handles incoming push payloads and notification clicks.
 */

self.addEventListener("push", (event) => {
  let title = "Notification";
  let message = "";
  /** @type {string} */
  let url = "/";
  try {
    if (event.data) {
      const data = event.data.json();
      if (data && typeof data === "object") {
        if (typeof data.title === "string") title = data.title;
        if (typeof data.message === "string") message = data.message;
        else if (typeof data.body === "string") message = data.body;
        if (typeof data.url === "string") url = data.url;
      }
    }
  } catch {
    // keep defaults
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body: message,
      icon: "/icon-192x192.png",
      data: url,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const raw = event.notification.data;
  let target = "/";
  if (typeof raw === "string") target = raw;
  else if (raw && typeof raw === "object" && typeof raw.url === "string") target = raw.url;

  let href;
  try {
    href = new URL(target, self.location.origin).href;
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
      if (self.clients.openWindow) {
        return self.clients.openWindow(href);
      }
      return undefined;
    }),
  );
});
