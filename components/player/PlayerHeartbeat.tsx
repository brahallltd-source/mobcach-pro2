"use client";

import { useEffect } from "react";

const HEARTBEAT_INTERVAL_MS = 180000;

export function PlayerHeartbeat() {
  useEffect(() => {
    const ping = () => {
      void fetch("/api/user/heartbeat", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      }).catch(() => {});
    };

    ping();
    const interval = window.setInterval(ping, HEARTBEAT_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  return null;
}
