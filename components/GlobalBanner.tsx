"use client";

import { useEffect, useState } from "react";

/**
 * Live announcement from `SystemSettings.announcement` for signed-in agents.
 * Renders nothing when empty or unauthenticated.
 */
export function GlobalBanner() {
  const [text, setText] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/agent/system-context", {
          credentials: "include",
          cache: "no-store",
        });
        if (!res.ok) return;
        const j = (await res.json()) as { announcement?: unknown };
        const a = String(j.announcement ?? "").trim();
        if (!cancelled) setText(a);
      } catch {
        if (!cancelled) setText("");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!text) return null;

  return (
    <div
      className="mb-4 rounded-2xl border border-cyan-500/35 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-50 whitespace-pre-wrap shadow-lg shadow-cyan-950/20"
      role="status"
    >
      {text}
    </div>
  );
}
