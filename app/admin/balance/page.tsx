
"use client";

import { useEffect, useMemo, useState } from "react";
import { formatApiError } from "@/lib/format-api-error";
import { CASH_NETWORKS, CRYPTO_NETWORKS, MOROCCAN_BANKS } from "@/lib/payment-options";
import { DangerButton, GlassCard, PageHeader, PrimaryButton, SelectField, SidebarShell, StatCard, TextField } from "@/components/ui";

type PaymentMethod = { id: string; type: "bank" | "crypto" | "cash"; method_name: string; account_name?: string; rib?: string; wallet_address?: string; currency: string; network?: string; phone?: string; fee_percent?: number };
type TopupRequest = { id: string; agentId: string; agentEmail: string; amount: number; admin_method_name: string; tx_hash?: string; proof_url?: string; note?: string; status: string; bonus_amount?: number; pendingBonusApplied?: number; created_at: string; gosport365Username?: string | null; targetUsername?: string | null };
type MethodForm = { type: "bank" | "crypto" | "cash"; method_name: string; currency: string; account_name: string; rib: string; wallet_address: string; network: string; phone: string; fee_percent: string };
const initialMethodForm: MethodForm = { type: "bank", method_name: MOROCCAN_BANKS[0], currency: "MAD", account_name: "", rib: "", wallet_address: "", network: CRYPTO_NETWORKS[0], phone: "", fee_percent: "0" };

export default function AdminBalancePage() {
  const [agentId, setAgentId] = useState("");
  const [amount, setAmount] = useState("1000");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [methodForm, setMethodForm] = useState<MethodForm>(initialMethodForm);
  const [editingMethodId, setEditingMethodId] = useState<string | null>(null);

  const load = async () => {
    const [methodsRes, requestsRes] = await Promise.all([
      fetch("/api/admin/payment-methods", { cache: "no-store", credentials: "include" }).then((res) => res.json()),
      fetch("/api/admin/topup-requests", { cache: "no-store" }).then((res) => res.json())
    ]);
    setMethods(methodsRes.methods || []);
    setRequests(requestsRes.requests || []);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => ({
    bank: methods.filter((m) => m.type === "bank").length,
    cash: methods.filter((m) => m.type === "cash").length,
    crypto: methods.filter((m) => m.type === "crypto").length,
    pending: requests.filter((r) => String(r.status).toUpperCase() === "PENDING").length,
  }), [methods, requests]);

  const handleTopup = async () => {
    if (!agentId.trim() || !amount.trim()) return alert("Agent ID and amount required");
    setLoading(true);
    setResult(null);
    const res = await fetch("/api/admin/topup-agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, amount: Number(amount), adminEmail: "admin@mobcash.com" })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(formatApiError(data));
      setLoading(false);
      return;
    }
    setResult(data.summary);
    await load();
    setLoading(false);
  };

  const addOrSaveMethod = async () => {
    setLoading(true);
    const accountNumber =
      methodForm.type === "crypto"
        ? methodForm.wallet_address.trim()
        : methodForm.type === "bank"
          ? methodForm.rib.trim()
          : methodForm.phone.trim();
    const payload: Record<string, unknown> = {
      name: methodForm.method_name.trim(),
      type: methodForm.type,
      accountName: methodForm.account_name.trim(),
      accountNumber,
      currency: methodForm.type === "crypto" ? methodForm.currency : "MAD",
      network: methodForm.network.trim(),
      phone: methodForm.phone.trim(),
      fee_percent: Number(methodForm.fee_percent || 0),
    };
    if (!editingMethodId) payload.isActive = true;
    if (editingMethodId) payload.id = editingMethodId;
    const res = await fetch("/api/admin/payment-methods", {
      method: editingMethodId ? "PUT" : "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(formatApiError(data));
      setLoading(false);
      return;
    }
    setMethodForm(initialMethodForm);
    setEditingMethodId(null);
    await load();
    setLoading(false);
  };

  const editMethod = (method: PaymentMethod) => {
    setEditingMethodId(method.id);
    setMethodForm({
      type: method.type,
      method_name: method.method_name,
      currency: method.currency || (method.type === "crypto" ? "USDT" : "MAD"),
      account_name: method.account_name || "",
      rib: method.rib || "",
      wallet_address: method.wallet_address || "",
      network: method.network || CRYPTO_NETWORKS[0],
      phone: method.phone || "",
      fee_percent: String(method.fee_percent || 0)
    });
  };

  const deleteMethod = async (methodId: string) => {
    if (!confirm("Delete this admin method?")) return;
    setLoading(true);
    const res = await fetch(`/api/admin/payment-methods?methodId=${encodeURIComponent(methodId)}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(formatApiError(data));
      setLoading(false);
      return;
    }
    await load();
    setLoading(false);
  };

  const reviewRequest = async (requestId: string, action: "approve" | "reject") => {
    setLoading(true);
    const res = await fetch("/api/admin/topup-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action, adminEmail: "admin@mobcash.com" })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(formatApiError(data));
      setLoading(false);
      return;
    }
    await load();
    setLoading(false);
  };

  return (
    <SidebarShell role="admin">
      <PageHeader title="Treasury wallets" subtitle="Manage admin bank, cash and crypto treasury methods, approve agent recharge requests with proof review when needed, and keep the fixed 10% rule untouched." />
      <div className="grid gap-4 md:grid-cols-4">
        <StatCard label="Bank methods" value={String(stats.bank)} hint="Moroccan treasury bank accounts" />
        <StatCard label="Cash methods" value={String(stats.cash)} hint="Wafacash / Cash Plus" />
        <StatCard label="Crypto wallets" value={String(stats.crypto)} hint="Admin crypto wallets for tracked top-ups" />
        <StatCard label="Pending requests" value={String(stats.pending)} hint="Waiting for treasury review" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Direct manual top-up</h2>
          <div className="mt-5 grid gap-4">
            <TextField placeholder="Agent ID" value={agentId} onChange={(e) => setAgentId(e.target.value)} />
            <TextField type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <PrimaryButton onClick={handleTopup} disabled={loading}>{loading ? "Processing..." : "Top up agent now"}</PrimaryButton>
            {result ? <div className="rounded-3xl border border-white/10 bg-black/20 p-4 text-sm text-white/70">Previous: {result.previousBalance} DH • Base: {result.creditedBase} DH • Fixed 10%: {result.creditedBonus} DH • Pending bonus applied: {result.pendingBonusApplied || 0} DH • New balance: {result.newBalance} DH</div> : null}
          </div>

          <div className="mt-8">
            <h3 className="text-xl font-semibold">Admin payment methods</h3>
            <div className="mt-4 grid gap-4">
              <SelectField value={methodForm.type} onChange={(e) => setMethodForm((prev) => ({
                ...prev,
                type: e.target.value as "bank" | "crypto" | "cash",
                method_name: e.target.value === "bank" ? MOROCCAN_BANKS[0] : e.target.value === "cash" ? CASH_NETWORKS[0] : "USDT",
                currency: e.target.value === "crypto" ? "USDT" : "MAD"
              }))}>
                <option value="bank">Bank</option>
                <option value="cash">Cash</option>
                <option value="crypto">Crypto</option>
              </SelectField>

              <SelectField value={methodForm.method_name} onChange={(e) => setMethodForm((prev) => ({ ...prev, method_name: e.target.value }))}>
                {(methodForm.type === "bank" ? MOROCCAN_BANKS : methodForm.type === "cash" ? CASH_NETWORKS : ["USDT", "BTC"]).map((item) => <option key={item} value={item}>{item}</option>)}
              </SelectField>

              <TextField placeholder="Account name / label" value={methodForm.account_name} onChange={(e) => setMethodForm((prev) => ({ ...prev, account_name: e.target.value }))} />
              {methodForm.type === "bank" ? <TextField placeholder="RIB" value={methodForm.rib} onChange={(e) => setMethodForm((prev) => ({ ...prev, rib: e.target.value }))} /> : null}
              {methodForm.type === "cash" ? <TextField placeholder="Phone" value={methodForm.phone} onChange={(e) => setMethodForm((prev) => ({ ...prev, phone: e.target.value }))} /> : null}
              {methodForm.type === "crypto" ? (
                <>
                  <TextField placeholder="Wallet address" value={methodForm.wallet_address} onChange={(e) => setMethodForm((prev) => ({ ...prev, wallet_address: e.target.value }))} />
                  <SelectField value={methodForm.network} onChange={(e) => setMethodForm((prev) => ({ ...prev, network: e.target.value }))}>
                    {CRYPTO_NETWORKS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </SelectField>
                  <TextField placeholder="Currency" value={methodForm.currency} onChange={(e) => setMethodForm((prev) => ({ ...prev, currency: e.target.value }))} />
                </>
              ) : null}
              <PrimaryButton onClick={addOrSaveMethod} disabled={loading}>{editingMethodId ? "Save method" : "Add method"}</PrimaryButton>
            </div>

            <div className="mt-5 space-y-3">
              {methods.map((method) => (
                <div key={method.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-semibold">{method.method_name}</p>
                      <p className="mt-1 text-sm text-white/55">{method.type.toUpperCase()} • {method.currency}</p>
                      {method.rib ? <p className="mt-1 text-sm text-white/50">RIB: {method.rib}</p> : null}
                      {method.wallet_address ? <p className="mt-1 break-all text-sm text-white/50">Wallet: {method.wallet_address}</p> : null}
                    </div>
                    <div className="flex gap-2">
                      <PrimaryButton onClick={() => editMethod(method)}>Edit</PrimaryButton>
                      <DangerButton onClick={() => deleteMethod(method.id)}>Delete</DangerButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Agent recharge requests</h2>
          <div className="mt-5 space-y-4">
            {requests.map((request) => (
              <div key={request.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-semibold">{request.agentEmail}</p>
                    <p className="mt-1 text-sm text-white/55">{request.amount} DH • {request.admin_method_name}</p>
                    <p className="mt-1 text-sm text-cyan-200/90" dir="ltr">
                      GoSport365: {String(request.gosport365Username ?? request.targetUsername ?? "").trim() || "—"}
                    </p>
                    <p className="mt-1 text-sm text-white/45">{new Date(request.created_at).toLocaleString()}</p>
                    {request.note ? <p className="mt-2 text-sm text-white/55">{request.note}</p> : null}
                    {request.proof_url ? <a href={request.proof_url} target="_blank" rel="noreferrer" className="mt-3 inline-flex rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white hover:bg-white/10">Open proof</a> : null}
                    {request.status === "approved" ? <p className="mt-3 text-sm text-emerald-200">Fixed 10%: {request.bonus_amount || 0} DH • Pending bonus applied: {request.pendingBonusApplied || 0} DH</p> : null}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/75">{request.status}</div>
                    {String(request.status).toUpperCase() === "PENDING" ? (
                      <>
                        <PrimaryButton onClick={() => reviewRequest(request.id, "approve")} disabled={loading}>Approve</PrimaryButton>
                        <DangerButton onClick={() => reviewRequest(request.id, "reject")} disabled={loading}>Reject</DangerButton>
                      </>
                    ) : null}
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
