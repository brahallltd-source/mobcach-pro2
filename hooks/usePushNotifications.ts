"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import { PushNotifications } from "@capacitor/push-notifications";

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

const NATIVE_TOKEN_STORAGE_KEY = "native_push_token";
const NATIVE_PUSH_CHANNEL_ID = "gs365-high-priority";
const NATIVE_APP_ID = "com.gs365cash.app";

let nativeListenersAttached = false;
let latestNativeToken: string | null = null;

function isNativePlatform(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

function readStoredNativeToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const t = localStorage.getItem(NATIVE_TOKEN_STORAGE_KEY);
    return t ? String(t).trim() || null : null;
  } catch {
    return null;
  }
}

function storeNativeToken(token: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NATIVE_TOKEN_STORAGE_KEY, token);
  } catch {
    // ignore
  }
}

async function registerNativeTokenWithServer(token: string): Promise<boolean> {
  try {
    const res = await fetch("/api/push/native/register", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token,
        platform: "android",
        appId: NATIVE_APP_ID,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureNativeListeners(): Promise<void> {
  if (nativeListenersAttached) return;
  nativeListenersAttached = true;

  await PushNotifications.addListener("registration", (token) => {
    const value = String(token?.value ?? "").trim();
    if (!value) return;
    latestNativeToken = value;
    storeNativeToken(value);
    void registerNativeTokenWithServer(value);
  });

  await PushNotifications.addListener("registrationError", (error) => {
    console.error("[native-push] registrationError", error);
  });

  await PushNotifications.addListener("pushNotificationReceived", async (notification) => {
    // Foreground fallback: show local notification so high-priority channel sound/vibration is used.
    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: Date.now(),
            title: String(notification.title ?? "GS365 Cash"),
            body: String(notification.body ?? ""),
            channelId: NATIVE_PUSH_CHANNEL_ID,
          },
        ],
      });
    } catch {
      // ignore local display failures
    }
  });
}

async function ensureNativePushSetup(): Promise<boolean> {
  if (!isNativePlatform()) return false;

  try {
    await ensureNativeListeners();

    try {
      await PushNotifications.createChannel({
        id: NATIVE_PUSH_CHANNEL_ID,
        name: "GS365 High Priority",
        description: "High priority alerts with sound and vibration",
        importance: 5,
        visibility: 1,
        sound: "default",
        vibration: true,
        lights: true,
      });
    } catch {
      // channel may already exist; safe to continue
    }

    const perm = await PushNotifications.requestPermissions();
    if (String((perm as { receive?: string }).receive ?? "").toLowerCase() !== "granted") {
      return false;
    }

    // Request local notifications permission for foreground fallback.
    try {
      await LocalNotifications.requestPermissions();
    } catch {
      // ignore
    }

    const existing = latestNativeToken || readStoredNativeToken();
    if (existing) {
      latestNativeToken = existing;
      return registerNativeTokenWithServer(existing);
    }

    await PushNotifications.register();
    await new Promise((resolve) => setTimeout(resolve, 1200));

    const token = latestNativeToken || readStoredNativeToken();
    if (!token) return false;
    latestNativeToken = token;
    return registerNativeTokenWithServer(token);
  } catch {
    return false;
  }
}

export async function syncPushSubscriptionWithServer(): Promise<boolean> {
  if (isNativePlatform()) {
    return ensureNativePushSetup();
  }
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (!sub) return false;
    const res = await fetch("/api/web-push/subscribe", {
      method: "POST",
      credentials: "include",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [vapidPublicKey, setVapidPublicKey] = useState<string>(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim() || "",
  );

  const support = useMemo((): PushSupport => {
    if (isNativePlatform()) return "ready";
    if (typeof window === "undefined") return "unsupported";
    if (!("serviceWorker" in navigator)) return "unsupported_api";
    if (!("PushManager" in window)) return "unsupported_api";
    return "ready";
  }, []);

  const syncSubscription = useCallback(async () => {
    if (isNativePlatform()) {
      const ok = await ensureNativePushSetup();
      setIsSubscribed(ok);
      return;
    }
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setIsSubscribed(false);
      return;
    }
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      setIsSubscribed(Boolean(sub));
      if (sub) {
        await syncPushSubscriptionWithServer();
      }
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

  useEffect(() => {
    if (vapidPublicKey) return;
    const loadRuntimeVapidPublicKey = async () => {
      try {
        const res = await fetch("/api/web-push/public-key", {
          credentials: "include",
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          publicKey?: string;
        };
        const runtimeKey = String(data.publicKey ?? "").trim();
        if (res.ok && data.success && runtimeKey) {
          setVapidPublicKey(runtimeKey);
        }
      } catch {
        // Keep hook resilient; subscribe() will surface "vapid" if still missing.
      }
    };
    void loadRuntimeVapidPublicKey();
  }, [vapidPublicKey]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (support !== "ready") {
      setError("unsupported");
      return false;
    }

    if (isNativePlatform()) {
      setIsLoading(true);
      try {
        const ok = await ensureNativePushSetup();
        setIsSubscribed(ok);
        if (!ok) setError("permission");
        return ok;
      } finally {
        setIsLoading(false);
      }
    }

    const vapidPublic = vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
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
  }, [support, vapidPublicKey]);

  const unsubscribeLocal = useCallback(async (): Promise<void> => {
    if (isNativePlatform()) {
      try {
        await PushNotifications.removeAllListeners();
      } catch {
        // ignore
      }
      nativeListenersAttached = false;
      setIsSubscribed(false);
      return;
    }
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
    vapidConfigured: isNativePlatform() || Boolean(vapidPublicKey || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()),
    subscribe,
    unsubscribeLocal,
    refreshSubscription: syncSubscription,
    /** @deprecated use {@link subscribe} */
    subscribeToPush: subscribe,
  };
}
