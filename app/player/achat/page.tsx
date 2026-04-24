"use client";

import { useEffect } from "react";
import { GlassCard, LoadingCard, SidebarShell } from "@/components/ui";
import { fetchSessionUser, redirectToLogin } from "@/lib/client-session";

type SessionRecord = Record<string, unknown> & {
  role?: string;
  player?: { assignedAgentId?: string | null } | null;
  assigned_agent_id?: string;
};

export default function AchatPage() {
  useEffect(() => {
    void (async () => {
      let u = (await fetchSessionUser()) as SessionRecord | null;
      if (!u) {
        await new Promise((r) => setTimeout(r, 200));
        u = (await fetchSessionUser()) as SessionRecord | null;
      }
      if (!u) {
        redirectToLogin();
        return;
      }
      try {
        localStorage.setItem("mobcash_user", JSON.stringify(u));
      } catch {
        /* ignore */
      }
      if (String(u.role ?? "").toLowerCase() !== "player") {
        window.location.href = "/login";
        return;
      }
      const legacy = typeof u.assigned_agent_id === "string" ? u.assigned_agent_id.trim() : "";
      const fromPlayer =
        u.player && typeof u.player.assignedAgentId === "string" ? u.player.assignedAgentId.trim() : "";
      const agentId = legacy || fromPlayer;
      if (!agentId) {
        window.location.href = "/player/select-agent";
        return;
      }
      window.location.href = `/player/achat/${encodeURIComponent(agentId)}`;
    })();
  }, []);

  return (
    <SidebarShell role="player">
      <LoadingCard text="Opening your direct achat flow..." />
      <GlassCard className="p-8 text-center text-white/60">You are being redirected to your assigned agent checkout.</GlassCard>
    </SidebarShell>
  );
}
