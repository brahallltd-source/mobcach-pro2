"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Fingerprint, ShieldAlert } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard, StatusBadge, TextArea } from "@/components/ui";

type FraudItem = {
  id: string;
  orderId: string;
  playerEmail: string;
  agentId: string;
  amount: number;
  status: string;
  proof_url: string;
  proof_hash?: string;
  flags: string[];
  score: number;
  created_at: string;
  updated_at: string;
  review_reason?: string;
  review_required?: boolean;
  fraud_resolution?: { action?: string; note?: string; at?: string };
};

type Summary = { suspiciousOrders: number; duplicateHashes: number; pendingFlags: number };
type Filter = "all" | "high" | "open" | "resolved";

export default function AdminFraudPage() {
  const [items, setItems] = useState<FraudItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<FraudItem | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [actionNote, setActionNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const res = await fetch("/api/admin/fraud", { cache: "no-store" });
    const data = await res.json();
    setItems(data.items || []);
    setSummary(data.summary || null);
    setSelected((current) => {
      const next = (data.items || []).find((item: FraudItem) => item.id === current?.id);
      return next || (data.items || [])[0] || null;
    });
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const filteredItems = useMemo(() => {
    if (filter === "high") return items.filter((item) => item.score >= 70);
    if (filter === "open") return items.filter((item) => item.status !== "completed" || item.review_required);
    if (filter === "resolved") return items.filter((item) => item.fraud_resolution?.action === "resolved");
    return items;
  }, [filter, items]);

  const riskTone = useMemo(() => {
    if (!selected) return "text-white";
    if (selected.score >= 70) return "text-rose-300";
    if (selected.score >= 40) return "text-amber-300";
    return "text-emerald-300";
  }, [selected]);

  const runAction = async (action: "resolve" | "reopen") => {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/fraud-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: selected.orderId, action, note: actionNote }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.message || "Action failed");
        setBusy(false);
        return;
      }
      await load();
      setActionNote("");
      alert(data.message || "Updated successfully");
    } catch (error) {
      console.error(error);
      alert("Network error");
    }
    setBusy(false);
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading fraud center..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Fraud center" subtitle="Smarter proof review, duplicate-proof signals, action queue management and quick resolve / reopen controls from one admin workspace." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Suspicious orders" value={String(summary?.suspiciousOrders || 0)} hint="Orders requiring manual review" />
        <StatCard label="Duplicate proofs" value={String(summary?.duplicateHashes || 0)} hint="Repeated payment proof hashes" />
        <StatCard label="Open flags" value={String(summary?.pendingFlags || 0)} hint="Not yet completed / resolved" />
        <StatCard label="High risk" value={String(items.filter((item) => item.score >= 70).length)} hint="Urgent first-priority review" />
      </div>

      <div className="flex flex-wrap gap-3">
        {[
          ["all", "All queue"],
          ["high", "High risk"],
          ["open", "Open cases"],
          ["resolved", "Resolved"],
        ].map(([key, label]) => (
          <button key={key} onClick={() => setFilter(key as Filter)} className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${filter === key ? "bg-white text-black" : "border border-white/10 bg-white/5 text-white hover:bg-white/10"}`}>
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]">
        <GlassCard className="p-4 md:p-6">
          <div className="flex items-center gap-3"><ShieldAlert className="text-rose-300" size={18} /><h2 className="text-2xl font-semibold">Flag queue</h2></div>
          <div className="mt-4 space-y-3">
            {filteredItems.map((item) => (
              <button key={item.id} onClick={() => setSelected(item)} className={`w-full rounded-3xl border p-4 text-left transition ${selected?.id === item.id ? "border-cyan-300/30 bg-cyan-300/10" : "border-white/10 bg-black/20 hover:bg-white/5"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-white/40">{item.playerEmail}</p>
                    <h3 className="mt-1 text-lg font-semibold">Order {item.orderId}</h3>
                    <p className="mt-2 text-sm text-white/55">Agent {item.agentId} • {item.amount} DH</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-semibold ${item.score >= 70 ? "text-rose-300" : item.score >= 40 ? "text-amber-300" : "text-emerald-300"}`}>{item.score}/100</p>
                    <StatusBadge status={item.status} />
                  </div>
                </div>
                {item.flags?.length ? <p className="mt-3 text-xs uppercase tracking-[0.24em] text-rose-200">{item.flags.join(" • ")}</p> : null}
                {item.fraud_resolution?.action === "resolved" ? <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-200"><CheckCircle2 size={12} /> resolved</p> : null}
              </button>
            ))}
            {!filteredItems.length ? <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/60">No suspicious orders in this view.</div> : null}
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          {selected ? (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="text-sm text-white/40">Proof review panel</p>
                  <h2 className="mt-1 text-3xl font-semibold">Order {selected.orderId}</h2>
                  <p className="mt-2 text-sm text-white/55">{selected.playerEmail} • Agent {selected.agentId}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 px-5 py-4 text-right">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/35">Risk score</p>
                  <p className={`mt-2 text-4xl font-semibold ${riskTone}`}>{selected.score}</p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-amber-300"><AlertTriangle size={16} /> Flags</div>
                  <p className="mt-3 text-sm leading-6 text-white/70">{selected.flags?.length ? selected.flags.join(", ") : "No explicit flags"}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-cyan-300"><Fingerprint size={16} /> Proof hash</div>
                  <p className="mt-3 break-all text-sm leading-6 text-white/70">{selected.proof_hash || "No hash stored"}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-white/35">Review reason</p>
                  <p className="mt-3 text-sm leading-6 text-white/70">{selected.review_reason || "Manual operator review"}</p>
                </div>
              </div>

              {selected.proof_url ? (
                <div className="overflow-hidden rounded-[30px] border border-white/10 bg-black/20">
                  <Image src={selected.proof_url} alt="Proof" width={1400} height={900} className="h-auto w-full object-cover" />
                </div>
              ) : (
                <div className="rounded-[30px] border border-dashed border-white/10 bg-black/20 p-10 text-center text-white/50">No proof preview stored for this order.</div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
                  <p><span className="text-white/40">Created:</span> {new Date(selected.created_at).toLocaleString()}</p>
                  <p className="mt-2"><span className="text-white/40">Updated:</span> {new Date(selected.updated_at).toLocaleString()}</p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
                  <p><span className="text-white/40">Amount:</span> {selected.amount} DH</p>
                  <p className="mt-2"><span className="text-white/40">Status:</span> {selected.status}</p>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold text-white">Admin action note</p>
                <TextArea rows={4} value={actionNote} onChange={(e) => setActionNote(e.target.value)} placeholder="Optional note explaining why you resolve or reopen this fraud case" className="mt-3" />
                <div className="mt-4 flex flex-wrap gap-3">
                  <PrimaryButton onClick={() => runAction("resolve")} disabled={busy}>Resolve case</PrimaryButton>
                  <button onClick={() => runAction("reopen")} disabled={busy} className="rounded-2xl bg-rose-500 px-4 py-3 text-sm font-semibold text-black transition hover:bg-rose-400 disabled:opacity-60">Reopen case</button>
                </div>
                {selected.fraud_resolution?.action ? <p className="mt-4 text-sm text-white/60">Last action: {selected.fraud_resolution.action} • {selected.fraud_resolution.note || "No note"}</p> : null}
              </div>
            </div>
          ) : (
            <div className="rounded-3xl border border-white/10 bg-black/20 p-10 text-center text-white/60">Select a flagged order to review its proof.</div>
          )}
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
