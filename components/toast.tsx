"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from "lucide-react";
import { clsx } from "clsx";

type ToastType = "success" | "error" | "info" | "warning";

type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
};

type ToastContextType = {
  showToast: (input: Omit<ToastItem, "id">) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

function iconFor(type: ToastType) {
  if (type === "success") return CheckCircle2;
  if (type === "error") return AlertCircle;
  if (type === "warning") return AlertTriangle;
  return Info;
}

function toneFor(type: ToastType) {
  if (type === "success") {
    return "border-emerald-400/20 bg-emerald-500/10 text-emerald-100";
  }
  if (type === "error") {
    return "border-red-400/20 bg-red-500/10 text-red-100";
  }
  if (type === "warning") {
    return "border-amber-400/20 bg-amber-500/10 text-amber-100";
  }
  return "border-cyan-400/20 bg-cyan-500/10 text-cyan-100";
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const showToast = (input: Omit<ToastItem, "id">) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const item = { ...input, id };

    setItems((prev) => [item, ...prev]);

    window.setTimeout(() => {
      setItems((prev) => prev.filter((x) => x.id !== id));
    }, 3500);
  };

  const value = useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-3">
        {items.map((item) => {
          const Icon = iconFor(item.type);

          return (
            <div
              key={item.id}
              className={clsx(
                "pointer-events-auto rounded-[24px] border px-4 py-4 shadow-2xl backdrop-blur-xl",
                toneFor(item.type)
              )}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Icon size={18} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{item.title}</p>
                  {item.message ? (
                    <p className="mt-1 text-sm opacity-90">{item.message}</p>
                  ) : null}
                </div>

                <button
                  onClick={() =>
                    setItems((prev) => prev.filter((x) => x.id !== item.id))
                  }
                  className="rounded-xl p-1 opacity-70 transition hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside ToastProvider");
  }
  return ctx;
}