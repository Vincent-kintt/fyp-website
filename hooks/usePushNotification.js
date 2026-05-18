"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// Convert VAPID key from base64 URL encoding to Uint8Array
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

/**
 * Mount-time consistency check for the push subscription.
 *
 * The legacy behavior was to POST the existing subscription to the backend on
 * every mount, which (a) wasted bandwidth and (b) silently re-registered a
 * subscription the user may have revoked at the browser-permission level.
 *
 * Decides between three actions:
 *   - "cleanup": local sub exists but permission !== "granted" → unsubscribe +
 *     DELETE backend so the server state mirrors the user's intent.
 *   - "keep":    local sub exists and permission is granted → no POST.
 *   - "no-op":   no local sub.
 *
 * POSTs to /api/push/subscribe happen only from the subscribe button click and
 * from the SW's pushsubscriptionchange handler (per W3C Push API spec).
 *
 * @param {object} params
 * @param {PushSubscription|null} params.subscription
 * @param {NotificationPermission} params.permission
 * @param {(endpoint: string) => Promise<unknown>} params.deleteBackend
 * @param {(msg: string, err?: unknown) => void} params.log
 * @returns {Promise<"cleanup"|"keep"|"no-op">}
 */
export async function executeMountConsistencyCheck({
  subscription,
  permission,
  deleteBackend,
  log,
}) {
  if (!subscription) return "no-op";
  if (permission === "granted") return "keep";

  try {
    await subscription.unsubscribe();
  } catch (err) {
    log("[usePushNotification] consistency cleanup unsubscribe error:", err);
  }
  try {
    await deleteBackend(subscription.endpoint);
  } catch (err) {
    log("[usePushNotification] consistency cleanup delete error:", err);
  }
  return "cleanup";
}

async function deleteSubscriptionOnBackend(endpoint) {
  const res = await fetch("/api/push/subscribe", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint }),
  });
  return res.ok;
}

/**
 * Hook for managing Web Push notification subscription.
 * Handles: permission request, SW registration, subscription, backend sync.
 */
export function usePushNotification() {
  const [permission, setPermission] = useState("default");
  const [subscription, setSubscription] = useState(null);
  const [isSupported, setIsSupported] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const swRegistrationRef = useRef(null);

  // Sync subscription to backend
  const syncSubscriptionToBackend = useCallback(async (sub) => {
    try {
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: btoa(
              String.fromCharCode(
                ...new Uint8Array(sub.getKey("p256dh"))
              )
            ),
            auth: btoa(
              String.fromCharCode(...new Uint8Array(sub.getKey("auth")))
            ),
          },
        }),
      });
      return res.ok;
    } catch (err) {
      console.error("[usePushNotification] sync error:", err);
      return false;
    }
  }, []);

  // Check browser support and run a consistency check on mount.
  // POSTs do NOT happen here — only on subscribe-button click or
  // on the SW's pushsubscriptionchange event.
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;

    setIsSupported(supported);
    if (!supported) return;

    setPermission(Notification.permission);

    navigator.serviceWorker.ready
      .then(async (registration) => {
        swRegistrationRef.current = registration;
        const existingSub = await registration.pushManager.getSubscription();
        const action = await executeMountConsistencyCheck({
          subscription: existingSub,
          permission: Notification.permission,
          deleteBackend: deleteSubscriptionOnBackend,
          log: console.error,
        });
        if (action === "keep") {
          setSubscription(existingSub);
        } else {
          setSubscription(null);
        }
      })
      .catch((err) => {
        console.error("[usePushNotification] init error:", err);
      });
  }, []);

  // Subscribe — MUST be called from user gesture (click handler)
  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    setIsLoading(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result !== "granted") {
        setIsLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      swRegistrationRef.current = registration;

      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) {
        console.error("[usePushNotification] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set");
        setIsLoading(false);
        return false;
      }
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      });

      setSubscription(sub);
      const synced = await syncSubscriptionToBackend(sub);
      setIsLoading(false);
      return synced;
    } catch (err) {
      console.error("[usePushNotification] subscribe error:", err);
      setIsLoading(false);
      return false;
    }
  }, [isSupported, syncSubscriptionToBackend]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    if (!subscription) return false;
    setIsLoading(true);

    try {
      await fetch("/api/push/subscribe", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });

      await subscription.unsubscribe();
      setSubscription(null);
      setIsLoading(false);
      return true;
    } catch (err) {
      console.error("[usePushNotification] unsubscribe error:", err);
      setIsLoading(false);
      return false;
    }
  }, [subscription]);

  return {
    isSupported,
    isSubscribed: !!subscription,
    isDenied: permission === "denied",
    isLoading,
    permission,
    subscribe,
    unsubscribe,
  };
}
