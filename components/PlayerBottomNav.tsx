"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import type { LucideIcon } from "lucide-react";
import { formatArabicChatOverflowBadge } from "@/lib/constants/i18n";

export type PlayerBottomNavItem = {
  href: string;
  label: string;
  mobileLabel?: string;
  icon: LucideIcon;
};

type PlayerBottomNavProps = {
  items: PlayerBottomNavItem[];
  unreadChatCount: number;
};

export function PlayerBottomNav({ items, unreadChatCount }: PlayerBottomNavProps) {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 bg-[#0B0F19]/85 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl lg:hidden"
      aria-label="التنقل السريع"
    >
      <div className="mx-auto grid w-full max-w-2xl grid-cols-6 gap-1 sm:gap-2">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "group relative flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-2 text-center transition-colors duration-300 ease-out",
                active
                  ? "text-primary animate-player-nav-active"
                  : "text-slate-400 hover:text-slate-200",
              )}
            >
              <span className="relative flex h-7 w-7 shrink-0 items-center justify-center">
                {active ? (
                  <span
                    className="absolute -top-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-primary shadow-[0_0_14px_rgba(34,211,238,0.65)]"
                    aria-hidden
                  />
                ) : null}
                <Icon
                  size={20}
                  strokeWidth={1.5}
                  className={clsx(
                    "relative transition-transform duration-300 ease-out",
                    active && "scale-105 text-primary drop-shadow-[0_0_8px_rgba(34,211,238,0.35)]",
                  )}
                  aria-hidden
                />
                {item.href === "/player/chat" && unreadChatCount > 0 ? (
                  <span className="absolute -right-1 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white shadow-md">
                    {formatArabicChatOverflowBadge(unreadChatCount)}
                  </span>
                ) : null}
              </span>
              <span
                className={clsx(
                  "max-w-full truncate px-0.5 text-[10px] font-medium leading-tight transition-all duration-300 ease-out",
                  active && "scale-105 text-primary",
                )}
              >
                {item.mobileLabel || item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
