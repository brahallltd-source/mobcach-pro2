"use client";

import { clsx } from "clsx";

const FLAG_STYLES: Record<string, string> = {
  HIGH_VALUE:
    "border-rose-500/55 bg-rose-600/25 text-rose-50 shadow-[0_0_14px_rgba(244,63,94,0.22)]",
  NEW_AGENT:
    "border-sky-500/50 bg-sky-600/20 text-sky-50 shadow-[0_0_12px_rgba(56,189,248,0.18)]",
};

function label(flag: string): string {
  if (flag === "HIGH_VALUE") return "🚩 مبلغ مرتفع";
  if (flag === "NEW_AGENT") return "🚩 وكيل جديد";
  return flag.replace(/_/g, " ");
}

export function FlagBadges({ flags, className }: { flags: string[] | null | undefined; className?: string }) {
  const list = Array.isArray(flags) ? flags.filter(Boolean) : [];
  if (!list.length) {
    return <span className={clsx("text-xs text-white/35", className)}>—</span>;
  }
  return (
    <div className={clsx("flex flex-wrap gap-1.5", className)}>
      {list.map((f) => (
        <span
          key={f}
          className={clsx(
            "inline-flex items-center rounded-lg border px-2 py-0.5 leading-snug tracking-normal",
            f === "HIGH_VALUE" || f === "NEW_AGENT"
              ? "text-[11px] font-semibold normal-case"
              : "text-[10px] font-bold uppercase tracking-wide",
            FLAG_STYLES[f] ?? "border-white/15 bg-white/[0.06] text-white/70"
          )}
        >
          {label(f)}
        </span>
      ))}
    </div>
  );
}
