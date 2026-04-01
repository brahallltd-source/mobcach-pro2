
"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleDollarSign, Landmark, Send, Wallet } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard, TextField } from "@/components/ui";

type User = { id: string; email: string; role: string };
type Winner = { id: string; amount: number; title?: string; status: string; created_at: string };
type Withdrawal = { id: string; amount: number; method: string; status: string; created_at: string; cashProvider?: string; rib?: string; swift?: string };

export default function PlayerWinningsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [history, setHistory] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState<"bank" | "cash">("bank");
  const [form, setForm] = useState({
    amount: "",
    rib: "",
    ribConfirm: "",
    swift: "",
    swiftConfirm: "",
    cashProvider: "Cash Express",
    fullName: "",
    phone: "",
    city: "",
  });

  const load = async (email: string) => {
    const res = await fetch(`/api/player/winnings?playerEmail=${encodeURIComponent(email)}`, { cache: "no-store" });
    const data = await res.json();
    setWinner(data.winner || null);
    setHistory(data.history || []);
    if (data.winner?.amount) {
      setForm((prev) => ({ ...prev, amount: String(data.winner.amount) }));
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: User = JSON.parse(saved);
    if (current.role !== "player") return void (window.location.href = "/login");
    setUser(current);
    load(current.email).finally(() => setLoading(false));
  }, []);

  const pendingRequest = useMemo(() => history.find((item) => ["pending", "agent_approved", "sent"].includes(item.status)), [history]);

  const submit = async () => {
    if (!user || !winner) return;
    setSaving(true);
    const res = await fetch("/api/player/winnings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerEmail: user.email, method, ...form, amount: Number(form.amount) }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to submit payout request");
      setSaving(false);
      return;
    }
    await load(user.email);
    alert(data.message || "Payout request sent");
    setSaving(false);
  };

  if (loading || !user) return <SidebarShell role="player"><LoadingCard text="Loading winnings..." /></SidebarShell>;

  return (
    <SidebarShell role="player">
      <PageHeader title="My winnings" subtitle="A clearer payout flow for winning players with real approval stages, visible history and a cleaner request form." />
      {!winner ? (
        <GlassCard className="p-10 text-center">No winning prize is available on this account yet.</GlassCard>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard label="Prize amount" value={`${winner.amount} DH`} hint={winner.title || "Winner payout ready"} />
            <StatCard label="Prize status" value={winner.status} hint={pendingRequest ? "A payout request is already being processed" : "Ready to withdraw"} />
            <StatCard label="Payout request" value={pendingRequest ? pendingRequest.status : "not started"} hint={pendingRequest ? "Agent and admin are reviewing the payout chain" : "Submit your transfer details below"} />
            <StatCard label="History" value={String(history.length)} hint="All payout actions on this account" />
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <GlassCard className="p-6 md:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-100">
                    <CircleDollarSign size={14} />
                    Winner payout
                  </p>
                  <h2 className="mt-4 text-3xl font-semibold">{winner.amount} DH</h2>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-white/60">
                    Your payout request goes through a visible chain: request submission, agent approval, then admin transfer confirmation.
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="grid gap-2 text-sm text-white/60">
                    <span>1. Submit payout details</span>
                    <span>2. Agent approval</span>
                    <span>3. Admin transfer</span>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-3 sm:grid-cols-2">
                <button onClick={() => setMethod("bank")} className={`rounded-3xl border px-4 py-4 text-left transition ${method === "bank" ? "border-cyan-300/30 bg-cyan-300/10 text-white" : "border-white/10 bg-black/20 text-white/70 hover:bg-white/[0.06]"}`}>
                  <div className="flex items-center gap-3"><Landmark size={18} /><span className="font-semibold">Bank transfer</span></div>
                  <p className="mt-2 text-sm text-white/55">Use complete RIB + SWIFT with confirmation fields.</p>
                </button>
                <button onClick={() => setMethod("cash")} className={`rounded-3xl border px-4 py-4 text-left transition ${method === "cash" ? "border-cyan-300/30 bg-cyan-300/10 text-white" : "border-white/10 bg-black/20 text-white/70 hover:bg-white/[0.06]"}`}>
                  <div className="flex items-center gap-3"><Wallet size={18} /><span className="font-semibold">Cash transfer</span></div>
                  <p className="mt-2 text-sm text-white/55">Cash Express, Cash Plus or Wafacash delivery details.</p>
                </button>
              </div>

              <div className="mt-6 grid gap-4">
                <div className="space-y-2"><label className="text-sm font-medium text-white/80">Winning amount (DH)</label><TextField value={form.amount} disabled /></div>

                {method === "bank" ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><label className="text-sm font-medium text-white/80">RIB</label><TextField value={form.rib} onChange={(e) => setForm({ ...form, rib: e.target.value })} placeholder="Enter full RIB" /></div>
                    <div className="space-y-2"><label className="text-sm font-medium text-white/80">Confirm RIB</label><TextField value={form.ribConfirm} onChange={(e) => setForm({ ...form, ribConfirm: e.target.value })} placeholder="Confirm full RIB" /></div>
                    <div className="space-y-2"><label className="text-sm font-medium text-white/80">SWIFT</label><TextField value={form.swift} onChange={(e) => setForm({ ...form, swift: e.target.value })} placeholder="Enter SWIFT code" /></div>
                    <div className="space-y-2"><label className="text-sm font-medium text-white/80">Confirm SWIFT</label><TextField value={form.swiftConfirm} onChange={(e) => setForm({ ...form, swiftConfirm: e.target.value })} placeholder="Confirm SWIFT code" /></div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2"><label className="text-sm font-medium text-white/80">Cash provider</label><select value={form.cashProvider} onChange={(e) => setForm({ ...form, cashProvider: e.target.value })} className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none"><option>Cash Express</option><option>Cash Plus</option><option>Wafacash</option></select></div>
                    <div className="space-y-2"><label className="text-sm font-medium text-white/80">Full name</label><TextField value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Receiver full name" /></div>
                    <div className="space-y-2"><label className="text-sm font-medium text-white/80">Phone</label><TextField value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Receiver phone" /></div>
                    <div className="space-y-2"><label className="text-sm font-medium text-white/80">City</label><TextField value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" /></div>
                  </div>
                )}

                <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/60">
                  Once you submit, your agent is notified first. Admin will only send the funds after the agent approves the payout request.
                </div>

                <PrimaryButton onClick={submit} disabled={saving || Boolean(pendingRequest)} className="w-full md:w-auto">
                  <Send size={16} className="mr-2 inline-block" />
                  {pendingRequest ? "Request already in progress" : saving ? "Submitting..." : "Submit payout request"}
                </PrimaryButton>
              </div>
            </GlassCard>

            <GlassCard className="p-6 md:p-8">
              <h2 className="text-2xl font-semibold">Payout history</h2>
              <div className="mt-5 space-y-3">
                {history.map((item) => (
                  <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-lg font-semibold">{item.amount} DH</p>
                        <p className="mt-1 text-sm text-white/55">{item.method === "bank" ? "Bank transfer" : item.cashProvider || "Cash transfer"}</p>
                        <p className="mt-1 text-sm text-white/45">{new Date(item.created_at).toLocaleString()}</p>
                      </div>
                      <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">{item.status.replaceAll("_", " ")}</div>
                    </div>
                  </div>
                ))}
                {!history.length ? <div className="rounded-3xl border border-dashed border-white/10 p-6 text-center text-white/55">No payout history yet.</div> : null}
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </SidebarShell>
  );
}
