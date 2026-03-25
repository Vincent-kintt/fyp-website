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

  // Check browser support and current state on mount
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
      .then((registration) => {
        swRegistrationRef.current = registration;
        return registration.pushManager.getSubscription();
      })
      .then((existingSub) => {
        if (existingSub) {
          setSubscription(existingSub);
          syncSubscriptionToBackend(existingSub);
        }
      })
      .catch((err) => {
        console.error("[usePushNotification] init error:", err);
      });
  }, [syncSubscriptionToBackend]);

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
