// Push-only service worker for ReminderApp
// No offline caching — this handles push notifications only

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = {
      title: "ReminderApp",
      body: event.data.text(),
    };
  }

  const options = {
    body: payload.body || "You have a reminder",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: payload.tag || "reminder",
    renotify: true,
    data: {
      url: payload.url || "/dashboard",
      reminderId: payload.reminderId,
    },
    actions: [
      { action: "open", title: "Open" },
      { action: "dismiss", title: "Dismiss" },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title || "ReminderApp", options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const url = event.notification.data?.url || "/dashboard";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// ---------------------------------------------------------------------------
// pushsubscriptionchange — browser-initiated subscription refresh
// ---------------------------------------------------------------------------
// Fires when the push service rotates or invalidates the existing subscription
// (e.g. quota exceeded, server-side expiry). Safari/iOS does NOT fire this
// event — the mount-time consistency check in usePushNotification is the
// fallback there. Per W3C Push API §6.5 the SW must re-subscribe and notify
// the application server.

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function bufferToBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

async function postSubscriptionToBackend(sub) {
  return fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys: {
        p256dh: bufferToBase64(sub.getKey("p256dh")),
        auth: bufferToBase64(sub.getKey("auth")),
      },
    }),
  });
}

async function fetchVapidPublicKey() {
  try {
    const res = await fetch("/api/push/vapid-key");
    if (!res.ok) return null;
    const json = await res.json();
    return json?.data?.publicKey ?? json?.publicKey ?? null;
  } catch {
    return null;
  }
}

async function handlePushSubscriptionChange({
  swRegistration,
  vapidKey,
  postToBackend,
  log,
}) {
  if (!vapidKey) {
    log("[sw] pushsubscriptionchange: VAPID key unavailable, bailing");
    return;
  }
  let newSub;
  try {
    newSub = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  } catch (err) {
    log("[sw] pushsubscriptionchange: subscribe failed", err);
    return;
  }
  try {
    await postToBackend(newSub);
  } catch (err) {
    log("[sw] pushsubscriptionchange: backend POST failed", err);
  }
}

self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      const vapidKey = await fetchVapidPublicKey();
      await handlePushSubscriptionChange({
        swRegistration: self.registration,
        vapidKey,
        postToBackend: postSubscriptionToBackend,
        log: console.error,
      });
    })()
  );
});
