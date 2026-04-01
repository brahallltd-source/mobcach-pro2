
"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SidebarShell, StatCard, TextArea, TextField } from "@/components/ui";

type TopupRequest = {
  id: string;
  agentId: string;
  agentEmail: string;
  amount: number;
  admin_method_name: string;
  tx_hash?: string;
  proof_url?: string;
  proof_hash?: string;
  note?: string;
  status: string;
  created_at: string;
  transfer_reference?: string;
  admin_note?: string;
  bonus_amount?: number;
  pendingBonusApplied?: number;
};

export default function AdminRechargeRequestsPage() {
  const [items, setItems] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("admin@mobcash.com");
  const [refs, setRefs] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    const res = await fetch("/api/admin/topup-requests", { cache: "no-store", credentials: "include" });
    const data = await res.json();
    setItems((data.requests || []).sort((a: TopupRequest, b: TopupRequest) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const pending = useMemo(() => items.filter((item) => item.status === "pending").length, [items]);
  const approved = useMemo(() => items.filter((item) => item.status === "approved").length, [items]);
  const rejected = useMemo(() => items.filter((item) => item.status === "rejected").length, [items]);

  const act = async (requestId: string, action: "approve" | "reject") => {
    setBusyId(requestId);
    const res = await fetch("/api/admin/topup-requests", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        action,
        adminEmail,
        transfer_reference: refs[requestId] || "",
        admin_note: notes[requestId] || "",
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to process request");
      setBusyId(null);
      return;
    }
    await load();
    setBusyId(null);
    alert(data.message || "Request processed");
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading recharge requests..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Agent recharge requests"
        subtitle="Review agent credit requests, inspect transfer details, approve or reject the recharge and let the system apply the fixed 10% bonus plus pending bonus automatically."
      />

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Pending" value={String(pending)} hint="Needs review now" />
        <StatCard label="Approved" value={String(approved)} hint="Processed successfully" />
        <StatCard label="Rejected" value={String(rejected)} hint="Rejected requests" />
        <StatCard label="Admin email" value={adminEmail} hint="Used for topup logging" />
      </div>

      <GlassCard className="p-4 md:p-5">
        <TextField value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="Admin email used in processing logs" />
      </GlassCard>

      <div className="space-y-4">
        {items.map((item) => (
          <GlassCard key={item.id} className="p-6">
            <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
              <div>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-semibold">{item.agentEmail}</h3>
                    <p className="mt-2 text-sm text-white/55">
                      {item.amount} DH • {item.admin_method_name} • {new Date(item.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                    {item.status.replaceAll("_", " ")}
                  </div>
                </div>

                <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/65">
                  <div className="grid gap-2">
                    {item.tx_hash ? <p>Tx Hash: <span className="break-all font-semibold text-white">{item.tx_hash}</span></p> : null}
                    {item.note ? <p>Agent note: <span className="font-semibold text-white">{item.note}</span></p> : null}
                    {item.proof_url ? <p>Proof URL: <span className="break-all font-semibold text-white">{item.proof_url}</span></p> : null}
                    {item.bonus_amount ? <p>Fixed 10% bonus applied: <span className="font-semibold text-emerald-200">{item.bonus_amount} DH</span></p> : null}
                    {item.pendingBonusApplied ? <p>Pending bonus applied: <span className="font-semibold text-amber-200">{item.pendingBonusApplied} DH</span></p> : null}
                    {item.transfer_reference ? <p>Transfer reference: <span className="font-semibold text-white">{item.transfer_reference}</span></p> : null}
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white/85">Processing data</p>
                <TextField
                  value={refs[item.id] || ""}
                  onChange={(e) => setRefs((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Transfer reference / processing id"
                  className="mt-3"
                />
                <TextArea
                  rows={5}
                  value={notes[item.id] || ""}
                  onChange={(e) => setNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                  placeholder="Admin note"
                  className="mt-3"
                />
                <div className="mt-4 flex flex-wrap gap-3">
                  <PrimaryButton onClick={() => act(item.id, "approve")} disabled={busyId === item.id || item.status !== "pending"}>
                    {busyId === item.id ? "Processing..." : "Approve"}
                  </PrimaryButton>
                  <button
                    onClick={() => act(item.id, "reject")}
                    disabled={busyId === item.id || item.status !== "pending"}
                    className="rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/20 disabled:opacity-50"
                  >
                    {busyId === item.id ? "Processing..." : "Reject"}
                  </button>
                </div>
              </div>
            </div>
          </GlassCard>
        ))}
        {!items.length ? <GlassCard className="p-10 text-center text-white/65">No recharge requests yet.</GlassCard> : null}
      </div>
    </SidebarShell>
  );
}
