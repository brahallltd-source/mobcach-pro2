"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

type TabsCtx = {
  value: string;
  onValueChange: (v: string) => void;
};

const TabsContext = React.createContext<TabsCtx | null>(null);

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (v: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  const [uncontrolled, setUncontrolled] = React.useState(defaultValue ?? "");
  const isControlled = value !== undefined;
  const current = isControlled ? value! : uncontrolled;
  const set = React.useCallback(
    (v: string) => {
      if (!isControlled) setUncontrolled(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange]
  );
  const ctx = React.useMemo(() => ({ value: current, onValueChange: set }), [current, set]);
  return (
    <TabsContext.Provider value={ctx}>
      <div className={cn("w-full", className)}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      role="tablist"
      className={cn(
        "inline-flex h-11 flex-wrap items-center justify-start gap-1 rounded-2xl border border-white/10 bg-white/[0.04] p-1",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsTrigger must be inside Tabs");
  const on = ctx.value === value;
  return (
    <button
      type="button"
      role="tab"
      aria-selected={on}
      className={cn(
        "rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40",
        on ? "bg-white text-slate-950 shadow" : "text-white/65 hover:bg-white/10 hover:text-white",
        className
      )}
      onClick={() => ctx.onValueChange(value)}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  className,
  children,
}: {
  value: string;
  className?: string;
  children: React.ReactNode;
}) {
  const ctx = React.useContext(TabsContext);
  if (!ctx) throw new Error("TabsContent must be inside Tabs");
  if (ctx.value !== value) return null;
  return (
    <div role="tabpanel" className={cn("mt-4 focus-visible:outline-none", className)}>
      {children}
    </div>
  );
}
