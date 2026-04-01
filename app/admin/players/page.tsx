"use client";

import { useEffect, useState } from "react";
import { DangerButton, GlassCard, LoadingCard, PageHeader, SidebarShell, StatusBadge } from "@/components/ui";

type PlayerRow = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  status: string;
  assigned_agent_id: string;
  created_at: string;
  frozen?: boolean;
};

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    const res = await fetch("/api/admin/players", { cache: "no-store" });
    const data = await res.json();
    setPlayers(data.players || []);
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const toggleFreeze = async (playerId: string) => {
    setBusyId(playerId);
    const res = await fetch("/api/admin/toggle-player-freeze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Update failed");
      setBusyId(null);
      return;
    }
    await load();
    setBusyId(null);
  };

  const removePlayer = async (playerId: string) => {
    if (!confirm("Delete this player and related records?")) return;
    setBusyId(playerId);
    const res = await fetch("/api/admin/delete-player", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Delete failed");
      setBusyId(null);
      return;
    }
    await load();
    setBusyId(null);
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading players..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Players" subtitle="Admin overview of all player accounts with a direct delete action for cleanup and fraud response." />
      <div className="space-y-4">
        {players.map((player) => (
          <GlassCard key={player.id} className="p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-xl font-semibold">{player.first_name} {player.last_name}</h3>
                <p className="mt-2 text-sm text-white/55">{player.email}</p>
                <p className="mt-2 text-sm text-white/45">Assigned agent: {player.assigned_agent_id || "—"} • {new Date(player.created_at).toLocaleString()}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <StatusBadge status={player.frozen ? "frozen" : player.status} />
                <button onClick={() => toggleFreeze(player.id)} disabled={busyId === player.id} className="rounded-2xl border border-amber-300/20 bg-amber-400/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-400/20">{player.frozen ? "Unfreeze" : "Freeze"}</button>
                <DangerButton onClick={() => removePlayer(player.id)} disabled={busyId === player.id}>
                  {busyId === player.id ? "Deleting..." : "Delete player"}
                </DangerButton>
              </div>
            </div>
          </GlassCard>
        ))}
        {!players.length ? <GlassCard className="p-10 text-center">No players found.</GlassCard> : null}
      </div>
    </SidebarShell>
  );
}
