"use client";

import { clsx } from "clsx";

type Props = {
  id?: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
  "aria-label"?: string;
};

/** Accessible toggle (shadcn-style API without Radix dependency). */
export function Switch({ id, checked, onCheckedChange, disabled, "aria-label": ariaLabel }: Props) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => !disabled && onCheckedChange(!checked)}
      className={clsx(
        "relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border border-white/10 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-45",
        checked ? "bg-primary" : "bg-white/15"
      )}
    >
      <span
        className={clsx(
          "pointer-events-none absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-5" : "translate-x-0.5"
        )}
      />
    </button>
  );
}
