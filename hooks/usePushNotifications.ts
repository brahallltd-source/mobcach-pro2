"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

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
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const support = useMemo((): PushSupport => {
    if (typeof window === "undefined") return "unsupported";
    if (!("serviceWorker" in navigator)) return "unsupported_api";
    if (!("PushManager" in window)) return "unsupported_api";
    return "ready";
  }, []);

  const syncSubscription = useCallback(async () => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setIsSubscribed(false);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
    } catch {
      setIsSubscribed(false);
    }
  }, []);

  useEffect(() => {
    void syncSubscription();
  }, [syncSubscription]);

  useEffect(() => {
    if (typeof Notification === "undefined") return;
    const syncPerm = () => setPermission(Notification.permission);
    syncPerm();
    document.addEventListener("visibilitychange", syncPerm);
    return () => document.removeEventListener("visibilitychange", syncPerm);
  }, []);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (support !== "ready") {
      setError("unsupported");
      return false;
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!vapidPublic) {
      setError("vapid");
      return false;
    }

    setIsLoading(true);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setError("permission");
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
        setError(data.message || `http_${res.status}`);
        setIsSubscribed(false);
        return false;
      }

      setIsSubscribed(true);
      return true;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "unknown");
      setIsSubscribed(false);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [support]);

  const unsubscribeLocal = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) await sub.unsubscribe();
    } catch {
      /* ignore */
    }
    setIsSubscribed(false);
  }, []);

  return {
    support,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribeLocal,
    refreshSubscription: syncSubscription,
    /** @deprecated use {@link subscribe} */
    subscribeToPush: subscribe,
  };
}
