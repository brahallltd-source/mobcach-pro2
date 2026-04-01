"use client";

import { useEffect } from "react";
import { GlassCard, LoadingCard, SidebarShell } from "@/components/ui";

type CurrentUser = { id: string; email: string; role: string; player_status?: "inactive" | "active"; assigned_agent_id?: string };

export default function AchatPage() {
  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: CurrentUser = JSON.parse(saved);
    if (current.role !== "player") return void (window.location.href = "/login");
    if (!current.assigned_agent_id) return void (window.location.href = "/player/select-agent");
    window.location.href = `/player/achat/${current.assigned_agent_id}`;
  }, []);

  return (
    <SidebarShell role="player">
      <LoadingCard text="Opening your direct achat flow..." />
      <GlassCard className="p-8 text-center text-white/60">You are being redirected to your assigned agent checkout.</GlassCard>
    </SidebarShell>
  );
}
