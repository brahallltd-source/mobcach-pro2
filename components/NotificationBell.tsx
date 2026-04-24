"use client";

/**
 * In-app notification bell: polls `GET /api/notifications?for=me&limit=5` every 30s,
 * unread badge, dropdown of last 5, mark-all / per-row read via `PATCH`.
 * New unread items since the previous poll surface a live **sonner** toast.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BellRing } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import { formatArabicUnreadBadge } from "@/lib/constants/i18n";

type InAppNotification = {
  id: string;
  title: string;
  message: string;
  type: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell({ active = true }: { active?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const lastUnreadRef = useRef<number | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications?for=me&limit=5", {
      credentials: "include",
      cache: "no-store",
    });
    if (res.status === 401) {
      setAuthorized(false);
      return;
    }
    if (!res.ok) return;
    setAuthorized(true);
    const data = (await res.json()) as {
      notifications?: InAppNotification[];
      unreadCount?: number;
    };
    const list = data.notifications ?? [];
    const count = Number(data.unreadCount ?? 0);

    if (lastUnreadRef.current !== null && count > lastUnreadRef.current) {
      const newest = list.find((n) => !n.isRead) ?? list[0];
      if (newest) {
        toast.message(newest.title, { description: newest.message });
      }
    }
    lastUnreadRef.current = count;

    setItems(list);
    setUnreadCount(count);
  }, []);

  useEffect(() => {
    if (!active) return;
    void fetchNotifications();
    const id = window.setInterval(() => void fetchNotifications(), 30_000);
    return () => window.clearInterval(id);
  }, [active, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (el && !el.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    lastUnreadRef.current = 0;
    setUnreadCount(0);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markOneRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    void fetchNotifications();
  };

  const onRowClick = async (n: InAppNotification) => {
    if (!n.isRead) await markOneRead(n.id);
    setOpen(false);
    if (n.link) router.push(n.link);
  };

  if (!active || authorized === false) return null;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-2xl border border-white/10 bg-white/5 p-2.5 text-white/85 transition hover:bg-white/10"
        aria-label="الإشعارات"
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
            <span className="text-xs font-semibold tracking-wider text-white/50">الإشعارات</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
              >
                تعليم الكل كمقروء
              </button>
            )}
          </div>
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {items.length === 0 ? (
              <li className="py-6 text-center text-sm text-white/45">لا توجد إشعارات بعد.</li>
            ) : (
              items.map((n) => (
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
