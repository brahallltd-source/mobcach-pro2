"use client";

import { useCallback, useMemo, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export type PushSupport = "unsupported" | "unsupported_api" | "ready";

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission | "default">(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const support = useMemo((): PushSupport => {
    if (typeof window === "undefined") return "unsupported";
    if (!("serviceWorker" in navigator)) return "unsupported_api";
    if (!("PushManager" in window)) return "unsupported_api";
    return "ready";
  }, []);

  const subscribeToPush = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (support !== "ready") {
      setError("Web Push is not supported in this browser.");
      return false;
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!vapidPublic) {
      setError("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured.");
      return false;
    }

    setSubscribing(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("Notification permission was not granted.");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await existing.unsubscribe();
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublic) as BufferSource,
      });

      const res = await fetch("/api/web-push/subscribe", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: subscription.toJSON() }),
      });

      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string };
      if (!res.ok || !data.success) {
        setError(data.message || `Subscribe failed (${res.status})`);
        return false;
      }

      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Subscribe failed");
      return false;
    } finally {
      setSubscribing(false);
    }
  }, [support]);

  return {
    support,
    permission,
    subscribing,
    error,
    subscribeToPush,
  };
}
