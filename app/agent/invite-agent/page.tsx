"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard, TextField } from "@/components/ui";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";

export default function InviteAgentPage() {
  const [user, setUser] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [email, setEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async (agentId: string) => {
    const res = await fetch(`/api/agent/invite-agent?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" });
    const data = await res.json();
    setRecords(data.invites || []);
  };

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) return void redirectToLogin();
      setUser(u);
      const currentAgentId = String((u as { agentId?: string }).agentId || u.id);
      load(currentAgentId).finally(() => setLoading(false));
    })();
  }, []);

  const eligible = useMemo(() => {
    const totalRecharge = records.reduce((sum, item) => sum + Number(item.total_recharge_amount || 0), 0);
    return records.length >= 5 || totalRecharge >= 5000;
  }, [records]);

  const generateInvite = async () => {
    // 🟢 الإصلاح 2: نتأكدو بلي عندنا ID قبل ما نحبسو الكود
    const currentAgentId = user?.agentId || user?.id;
    if (!currentAgentId) {
      alert("مشكل في بيانات الحساب، المرجو تسجيل الدخول مرة أخرى.");
      return;
    }

    const res = await fetch("/api/agent/invite-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        agentId: currentAgentId, 
        type: "generate", 
        invitedAgentEmail: email 
      }),
    });
    
    const data = await res.json();
    
    if (!res.ok) {
      return alert(data.message || "Failed to generate invite");
    }
    
    setInviteCode(data.invite?.invite_code || "");
    setInviteLink(data.inviteLink || "");
    await load(currentAgentId);
  };

  const copyInvite = async () => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const text = `Agent invite code: ${inviteCode}\nInvite link: ${base}${inviteLink}`;
    await navigator.clipboard.writeText(text);
    alert(`Invite copied!\n\nYou can now share the invite link with the new agent.`);
  };

  if (loading || !user) return <SidebarShell role="agent"><LoadingCard text="Loading invite agent..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader title="Invite an agent" subtitle="Generate an invite code and a ready link for new agents. Track invited agents and unlock the one-time bonus once thresholds are reached." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Invited agents" value={String(records.length)} hint="Tracked invite rows" />
        <StatCard label="Recharge made by invited agents" value={`${records.reduce((sum, item) => sum + Number(item.total_recharge_amount || 0), 0)} DH`} hint="Volume from invited agents" />
        <StatCard label="Bonus target" value="5 agents / 5000 DH" hint="Whichever comes first" />
        <StatCard label="Bonus" value={eligible ? "Ready" : records.some((item) => item.bonus_awarded) ? "Claimed" : "Locked"} hint="500 DH one-time reward" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Generate invite</h2>
          <div className="mt-5 space-y-4">
            <TextField placeholder="Invited agent email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} />
            <PrimaryButton onClick={generateInvite}>Generate Invite</PrimaryButton>
            <TextField placeholder="Invite code" value={inviteCode} onChange={() => {}} />
            <TextField placeholder="Invite link" value={inviteLink ? `${window.location.origin}${inviteLink}` : ""} onChange={() => {}} />
            <PrimaryButton onClick={copyInvite} disabled={!inviteCode}><Copy size={16} className="mr-2 inline-block" />Copy invite</PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Agent invite records</h2>
          <div className="mt-5 grid gap-4">
            {records.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{item.invited_agent_email || "Invite code only"}</p>
                    <p className="mt-1 text-sm text-white/55">Recharge total: {item.total_recharge_amount} DH</p>
                    <p className="mt-1 text-xs text-cyan-200">Code: {item.invite_code}</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${item.bonus_awarded ? "bg-emerald-400/10 text-emerald-200" : "bg-white/10 text-white/65"}`}>{item.bonus_awarded ? "awarded" : "tracking"}</div>
                </div>
                <p className="mt-3 text-sm text-white/45">{new Date(item.created_at).toLocaleString()}</p>
              </div>
            ))}
            {!records.length ? <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/55">No invited-agent records yet.</div> : null}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}