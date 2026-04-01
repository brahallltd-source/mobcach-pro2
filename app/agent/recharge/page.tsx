
"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SelectField, SidebarShell, StatCard, TextArea, TextField } from "@/components/ui";

type User = { role: string; email: string; agentId?: string };
type Wallet = { balance: number };
type AdminMethod = { id: string; type: string; method_name: string; currency: string; account_name?: string; rib?: string; wallet_address?: string; network?: string; phone?: string; fee_percent?: number };
type TopupRequest = { id: string; amount: number; admin_method_name: string; tx_hash?: string; proof_url?: string; status: string; created_at: string; note?: string; pendingBonusApplied?: number; bonus_amount?: number };

export default function AgentRechargePage() {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [methods, setMethods] = useState<AdminMethod[]>([]);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [form, setForm] = useState({ amount: "1000", admin_method_id: "", proof_url: "", proof_hash: "", tx_hash: "", note: "" });

  const load = async (agentId: string) => {
    const [walletRes, methodsRes, requestsRes] = await Promise.all([
      fetch(`/api/agent/wallet?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/admin/payment-methods-public`, { cache: "no-store" }).then((res) => res.json()),
      fetch(`/api/agent/topup-requests?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" }).then((res) => res.json()),
    ]);
    setWallet(walletRes.wallet || null);
    setMethods(methodsRes.methods || []);
    setRequests((requestsRes.requests || []).sort((a: TopupRequest, b: TopupRequest) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    if (!form.admin_method_id && (methodsRes.methods || [])[0]) setForm((prev) => ({ ...prev, admin_method_id: methodsRes.methods[0].id }));
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: User = JSON.parse(saved);
    if (current.role !== "agent") return void (window.location.href = "/login");
    setUser(current);
    if (current.agentId) load(current.agentId).finally(() => setLoading(false)); else setLoading(false);
  }, []);

  const selectedMethod = methods.find((item) => item.id === form.admin_method_id);
  const approvedCount = useMemo(() => requests.filter((item) => item.status === "approved").length, [requests]);
  const pendingCount = useMemo(() => requests.filter((item) => item.status === "pending").length, [requests]);

  const uploadProof = async () => {
    if (!proofFile || !user?.email) return null;
    const body = new FormData();
    body.append("file", proofFile);
    body.append("actorEmail", user.email);
    body.append("context", "agent_topup");
    const res = await fetch("/api/upload-transaction-proof", { method: "POST", body });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to upload proof");
      return null;
    }
    setForm((prev) => ({ ...prev, proof_url: data.proof.url, proof_hash: data.proof.hash }));
    return data.proof;
  };

  const submit = async () => {
    if (!user?.agentId) return;
    const selected = methods.find((item) => item.id === form.admin_method_id);
    if (!selected) return alert("Select an admin method");
    const requiresManualProof = selected.type !== "crypto";
    if (requiresManualProof && !proofFile) return alert("Upload your transfer proof first");

    setSaving(true);
    const proof = requiresManualProof ? await uploadProof() : { url: "", hash: "", duplicate_detected: false, suspicious_flags: [] };
    if (requiresManualProof && !proof) {
      setSaving(false);
      return;
    }

    const res = await fetch("/api/agent/topup-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: user.agentId,
        agentEmail: user.email,
        amount: Number(form.amount),
        admin_method_id: selected.id,
        admin_method_name: selected.method_name,
        tx_hash: "",
        proof_url: proof?.url || "",
        proof_hash: proof?.hash || "",
        note: form.note,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.message || "Failed to send recharge request");
      setSaving(false);
      return;
    }
    setForm((prev) => ({ ...prev, amount: "1000", proof_url: "", proof_hash: "", tx_hash: "", note: "" }));
    setProofFile(null);
    await load(user.agentId);
    setSaving(false);
    alert(data.message || "Recharge request sent");
  };

  if (loading || !user) return <SidebarShell role="agent"><LoadingCard text="Loading wallet recharge..." /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="Recharge agent credits"
        subtitle="Create a recharge request, upload transfer proof, then let admin review it. The system keeps the fixed 10% recharge bonus and any pending bonus applied automatically on approval."
      />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Wallet balance" value={`${wallet?.balance || 0} DH`} hint="Usable immediately after admin approval" />
        <StatCard label="Treasury methods" value={String(methods.length)} hint="Bank / cash / crypto methods from admin" />
        <StatCard label="Pending requests" value={String(pendingCount)} hint="Waiting for admin" />
        <StatCard label="Approved requests" value={String(approvedCount)} hint="Already processed" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Create recharge request</h2>
          <div className="mt-5 space-y-4">
            <TextField type="number" value={form.amount} onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))} placeholder="Amount" />
            <SelectField value={form.admin_method_id} onChange={(e) => setForm((prev) => ({ ...prev, admin_method_id: e.target.value }))}>
              {methods.map((item) => <option key={item.id} value={item.id}>{item.method_name} • {item.currency}</option>)}
            </SelectField>

            {selectedMethod ? (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm text-white/70">
                <p className="text-xs uppercase tracking-[0.22em] text-white/35">Transfer instructions</p>
                <div className="mt-3 grid gap-2">
                  <p>Method: <span className="font-semibold text-white">{selectedMethod.method_name}</span></p>
                  {selectedMethod.account_name ? <p>Account name: <span className="font-semibold text-white">{selectedMethod.account_name}</span></p> : null}
                  {selectedMethod.rib ? <p>RIB: <span className="font-semibold text-white">{selectedMethod.rib}</span></p> : null}
                  {selectedMethod.wallet_address ? <p>Wallet address: <span className="break-all font-semibold text-white">{selectedMethod.wallet_address}</span></p> : null}
                  {selectedMethod.network ? <p>Network: <span className="font-semibold text-white">{selectedMethod.network}</span></p> : null}
                  {selectedMethod.phone ? <p>Phone: <span className="font-semibold text-white">{selectedMethod.phone}</span></p> : null}
                </div>
              </div>
            ) : null}

            {selectedMethod?.type === "crypto" ? (
              <div className="rounded-3xl border border-cyan-400/15 bg-cyan-400/10 p-4 text-sm text-cyan-100">
                Crypto requests do not need Tx hash or image proof. You can complete them directly through your crypto provider flow.
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-white/10 bg-black/20 p-5">
                <p className="text-sm font-semibold text-white/85">Upload proof</p>
                <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-medium text-white/75 transition hover:bg-white/10">
                  <ImagePlus size={16} />
                  {proofFile ? proofFile.name : "Choose transfer proof"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}

            <TextArea rows={4} value={form.note} onChange={(e) => setForm((prev) => ({ ...prev, note: e.target.value }))} placeholder="Optional note for admin review" />

            <div className="rounded-3xl border border-cyan-400/15 bg-cyan-400/10 p-4 text-sm text-cyan-100">
              Every approved recharge keeps the fixed <strong>10%</strong> bonus rule. Pending bonus rewards are also applied automatically on approval.
            </div>

            <PrimaryButton onClick={submit} disabled={saving} className="w-full md:w-auto">
              {saving ? "Sending request..." : "Send recharge request"}
            </PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Recharge request history</h2>
          <div className="mt-5 space-y-4">
            {requests.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-semibold">{item.amount} DH</p>
                    <p className="mt-2 text-sm text-white/55">{item.admin_method_name}</p>
                    <p className="mt-1 text-sm text-white/45">{new Date(item.created_at).toLocaleString()}</p>
                                        {item.bonus_amount ? <p className="mt-2 text-xs text-emerald-200">10% bonus applied: {item.bonus_amount} DH</p> : null}
                    {item.pendingBonusApplied ? <p className="mt-1 text-xs text-amber-200">Pending bonus applied: {item.pendingBonusApplied} DH</p> : null}
                  </div>
                  <div className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
                    {item.status.replaceAll("_", " ")}
                  </div>
                </div>
              </div>
            ))}
            {!requests.length ? <div className="rounded-3xl border border-dashed border-white/10 p-6 text-center text-white/55">No recharge requests yet.</div> : null}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}
