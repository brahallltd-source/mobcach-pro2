"use client";

/**
 * In-app notification bell: SWR on `GET /api/notifications?for=me`, unread badge,
 * dropdown, mark-all / per-row read. New unread items toast via sonner.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { formatArabicUnreadBadge } from "@/lib/constants/i18n";
import { useAgentNotificationsSwr, type InAppNotificationRow } from "@/hooks/useAgentNotificationsSwr";
import { useTranslation } from "@/lib/i18n";
import { agentT } from "@/lib/i18n/dictionaries/agent";

export function NotificationBell({ active = true }: { active?: boolean }) {
  const router = useRouter();
  const { lang } = useTranslation();
  const { notifications, unreadCount, error, isLoading, mutate } = useAgentNotificationsSwr();
  const [open, setOpen] = useState(false);
  const lastUnreadRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (lastUnreadRef.current !== null && unreadCount > lastUnreadRef.current) {
      const newest = notifications.find((n) => !n.isRead) ?? notifications[0];
      if (newest) {
        toast.message(newest.title, { description: newest.message });
      }
    }
    lastUnreadRef.current = unreadCount;
  }, [notifications, unreadCount]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markAllRead = useCallback(async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    lastUnreadRef.current = 0;
    await mutate();
  }, [mutate]);

  const markOneRead = useCallback(
    async (id: string) => {
      await fetch("/api/notifications", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await mutate();
    },
    [mutate]
  );

  const onRowClick = async (n: InAppNotificationRow) => {
    if (!n.isRead) await markOneRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  if (!active) return null;
  if (error && (error as Error & { status?: number }).status === 401) return null;

  const tN = (k: Parameters<typeof agentT>[1]) => agentT(lang, k);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/85 transition hover:bg-white/10"
        aria-label={tN("notifications_aria")}
      >
        <BellRing size={18} />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 min-h-[18px] min-w-[18px] rounded-full bg-red-500 px-1 text-center text-[10px] font-bold leading-[18px] text-white shadow-md">
            {formatArabicUnreadBadge(unreadCount, 99)}
          </span>
        )}
      </button>

      {open && (
        <div
          className={clsx(
            "absolute z-[60] mt-2 w-[min(100vw-2rem,22rem)] rounded-2xl border border-white/10 bg-[#0B0F19] p-3 shadow-2xl backdrop-blur-md",
            "end-0"
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-white/10 pb-2">
            <span className="text-xs font-semibold tracking-wider text-white/50">{tN("notifications_title")}</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                {tN("notifications_mark_all")}
              </button>
            )}
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {isLoading && notifications.length === 0 ? (
              <li className="py-6 text-center text-sm text-white/45">…</li>
            ) : notifications.length === 0 ? (
              <li className="py-6 text-center text-sm text-white/45">{tN("notifications_empty")}</li>
            ) : (
              notifications.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void onRowClick(n)}
                    className={clsx(
                      "w-full rounded-xl px-3 py-2.5 text-start text-sm transition hover:bg-white/5",
                      !n.isRead && "bg-white/[0.06]"
                    )}
                  >
                    <span className="font-semibold text-white">{n.title}</span>
                    <p className="mt-0.5 line-clamp-2 text-xs text-white/55">{n.message}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
