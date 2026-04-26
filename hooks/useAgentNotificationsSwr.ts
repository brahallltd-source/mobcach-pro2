"use client";

import useSWR from "swr";

const NOTIFICATIONS_KEY = "/api/notifications?for=me&limit=25";

export type InAppNotificationRow = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

type NotificationsPayload = {
  notifications?: InAppNotificationRow[];
  unreadCount?: number;
};

const fetcher = async (url: string): Promise<NotificationsPayload> => {
  const res = await fetch(url, { credentials: "include", cache: "no-store" });
  if (res.status === 401) {
    const err = new Error("Unauthorized");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(String(res.status));
    (err as Error & { status?: number }).status = res.status;
    throw err;
  }
  return (await res.json()) as NotificationsPayload;
};

/**
 * Live agent/player notifications with SWR (deduped, 20s refresh).
 */
export function useAgentNotificationsSwr() {
  const { data, error, isLoading, isValidating, mutate } = useSWR(NOTIFICATIONS_KEY, fetcher, {
    refreshInterval: 20_000,
    revalidateOnFocus: true,
    dedupingInterval: 5_000,
  });

  const notifications = Array.isArray(data?.notifications) ? data!.notifications! : [];
  const unreadCount = Number(data?.unreadCount ?? 0);

  return {
    notifications,
    unreadCount,
    isLoading: Boolean(isLoading && !data),
    isValidating,
    error: error as Error | undefined,
    mutate,
    swrKey: NOTIFICATIONS_KEY,
  };
}
