"use client";

import { useEffect } from "react";

/** Keeps `User.lastSeen` / `isOnline` fresh for agents (~every 2 minutes). */
export function AgentSessionHeartbeat() {
  useEffect(() => {
    const ping = () => {
      void fetch("/api/user/heartbeat", { method: "POST", credentials: "include" });
    };
    void ping();
    const id = window.setInterval(ping, 120_000);
    return () => window.clearInterval(id);
  }, []);
  return null;
}
