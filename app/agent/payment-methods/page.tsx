"use client";

import { useEffect, useMemo, useState } from "react";
import { CASH_NETWORKS, CRYPTO_NETWORKS, MOROCCAN_BANKS } from "@/lib/payment-options";
import { DangerButton, GlassCard, LoadingCard, PageHeader, PrimaryButton, SelectField, SidebarShell, StatCard, TextArea, TextField } from "@/components/ui";

type User = { role: string; agentId?: string };
type Method = { id: string; type: "bank" | "crypto" | "cash"; method_name: string; currency: string; account_name?: string; rib?: string; wallet_address?: string; network?: string; phone?: string; fee_percent?: number; instructions?: string };
type FormState = { type: "bank" | "crypto" | "cash"; method_name: string; currency: string; account_name: string; rib: string; wallet_address: string; network: string; phone: string; fee_percent: string; instructions: string };
const initialForm: FormState = { type: "bank", method_name: MOROCCAN_BANKS[0], currency: "MAD", account_name: "", rib: "", wallet_address: "", network: CRYPTO_NETWORKS[0], phone: "", fee_percent: "0", instructions: "" };

export default function AgentPaymentMethodsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [methods, setMethods] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(initialForm);

  const load = async (agentId: string) => {
    const res = await fetch(`/api/agent/payment-methods?agentId=${encodeURIComponent(agentId)}`, { cache: "no-store" });
    const data = await res.json();
    setMethods(data.methods || []);
  };
  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: User = JSON.parse(saved);
    if (current.role !== "agent") return void (window.location.href = "/login");
    setUser(current);
    if (current.agentId) load(current.agentId).finally(() => setLoading(false)); else setLoading(false);
  }, []);

  const submit = async () => {
    if (!user?.agentId) return;
    setSaving(true);
    const res = await fetch("/api/agent/payment-methods", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: user.agentId, ...form, methodId: editingId, currency: form.type === "crypto" ? form.currency : "MAD", fee_percent: Number(form.fee_percent || 0) }) });
    const data = await res.json();
    if (!res.ok) { alert(data.message || "Failed to save method"); setSaving(false); return; }
    setForm(initialForm); setEditingId(null); await load(user.agentId); setSaving(false);
  };
  const edit = (method: Method) => { setEditingId(method.id); setForm({ type: method.type, method_name: method.method_name, currency: method.currency || (method.type === "crypto" ? "USDT" : "MAD"), account_name: method.account_name || "", rib: method.rib || "", wallet_address: method.wallet_address || "", network: method.network || CRYPTO_NETWORKS[0], phone: method.phone || "", fee_percent: String(method.fee_percent || 0), instructions: method.instructions || "" }); };
  const remove = async (methodId: string) => { if (!user?.agentId || !confirm("Delete this payment method?")) return; const res = await fetch(`/api/agent/payment-methods?agentId=${encodeURIComponent(user.agentId)}&methodId=${encodeURIComponent(methodId)}`, { method: "DELETE" }); const data = await res.json(); if (!res.ok) return alert(data.message || "Failed to delete"); await load(user.agentId); };
  const bankCount = useMemo(() => methods.filter((m) => m.type === "bank").length, [methods]);
  const cashCount = useMemo(() => methods.filter((m) => m.type === "cash").length, [methods]);
  const cryptoCount = useMemo(() => methods.filter((m) => m.type === "crypto").length, [methods]);
  if (loading || !user) return <SidebarShell role="agent"><LoadingCard text="Loading payment methods..." /></SidebarShell>;
  return <SidebarShell role="agent"><PageHeader title="Add your payment methods" subtitle="Separate your bank, cash and crypto methods clearly so players always see the right transfer information." /><div className="grid gap-4 md:grid-cols-4"><StatCard label="Configured methods" value={String(methods.length)} hint="All visible payment channels" /><StatCard label="Bank methods" value={String(bankCount)} hint="Moroccan banks with required RIB" /><StatCard label="Cash methods" value={String(cashCount)} hint="Cash Plus and Wafacash" /><StatCard label="Crypto methods" value={String(cryptoCount)} hint="USDT / BTC wallet options" /></div><div className="grid gap-6 xl:grid-cols-[0.88fr_1.12fr]"><GlassCard className="p-6 md:p-8"><h2 className="text-2xl font-semibold">{editingId ? "Edit payment method" : "Add new method"}</h2><div className="mt-5 grid gap-4"><SelectField value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as FormState["type"], method_name: e.target.value === "bank" ? MOROCCAN_BANKS[0] : e.target.value === "cash" ? CASH_NETWORKS[0] : "USDT", currency: e.target.value === "crypto" ? "USDT" : "MAD" }))}><option value="bank">Bank</option><option value="cash">Cash</option><option value="crypto">Crypto</option></SelectField>{form.type === "bank" ? <SelectField value={form.method_name} onChange={(e) => setForm((prev) => ({ ...prev, method_name: e.target.value }))}>{MOROCCAN_BANKS.map((bank) => <option key={bank} value={bank}>{bank}</option>)}</SelectField> : null}{form.type === "cash" ? <SelectField value={form.method_name} onChange={(e) => setForm((prev) => ({ ...prev, method_name: e.target.value }))}>{CASH_NETWORKS.map((item) => <option key={item} value={item}>{item}</option>)}</SelectField> : null}{form.type === "crypto" ? <><SelectField value={form.method_name} onChange={(e) => setForm((prev) => ({ ...prev, method_name: e.target.value, currency: e.target.value === "BTC" ? "BTC" : "USDT" }))}><option value="USDT">USDT</option><option value="BTC">BTC</option></SelectField><SelectField value={form.network} onChange={(e) => setForm((prev) => ({ ...prev, network: e.target.value }))}>{CRYPTO_NETWORKS.map((item) => <option key={item} value={item}>{item}</option>)}</SelectField></> : null}<TextField placeholder={form.type === "cash" ? "Full name" : "Account name"} value={form.account_name} onChange={(e) => setForm((prev) => ({ ...prev, account_name: e.target.value }))} />{form.type === "bank" ? <TextField placeholder="RIB (required)" value={form.rib} onChange={(e) => setForm((prev) => ({ ...prev, rib: e.target.value }))} /> : null}{form.type === "crypto" ? <TextField placeholder="Wallet address" value={form.wallet_address} onChange={(e) => setForm((prev) => ({ ...prev, wallet_address: e.target.value }))} /> : null}{form.type === "cash" ? <><TextField placeholder="Phone number" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} /><TextField type="number" min="0" placeholder="Fees / percentage" value={form.fee_percent} onChange={(e) => setForm((prev) => ({ ...prev, fee_percent: e.target.value }))} /></> : null}<TextArea rows={4} placeholder="Transfer instructions shown to the player" value={form.instructions} onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))} /><div className="flex flex-wrap gap-3"><PrimaryButton onClick={submit} disabled={saving}>{saving ? "Saving..." : editingId ? "Save changes" : "Add method"}</PrimaryButton>{editingId ? <DangerButton onClick={() => { setEditingId(null); setForm(initialForm); }}>Cancel edit</DangerButton> : null}</div></div></GlassCard><GlassCard className="p-6 md:p-8"><h2 className="text-2xl font-semibold">Configured payment methods</h2><div className="mt-5 grid gap-4">{methods.map((method) => <div key={method.id} className="rounded-3xl border border-white/10 bg-black/20 p-5"><div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between"><div><p className="text-lg font-semibold">{method.method_name}</p><p className="mt-1 text-sm text-white/55">{method.type} • {method.currency}</p></div><div className="flex gap-2"><button onClick={() => edit(method)} className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-slate-950">Edit</button><DangerButton onClick={() => remove(method.id)}>Delete</DangerButton></div></div><div className="mt-4 space-y-2 text-sm text-white/70">{method.account_name ? <p><span className="text-white/45">Name:</span> {method.account_name}</p> : null}{method.rib ? <p><span className="text-white/45">RIB:</span> {method.rib}</p> : null}{method.wallet_address ? <p><span className="text-white/45">Wallet:</span> {method.wallet_address}</p> : null}{method.network ? <p><span className="text-white/45">Network:</span> {method.network}</p> : null}{method.phone ? <p><span className="text-white/45">Phone:</span> {method.phone}</p> : null}{typeof method.fee_percent === "number" && method.type === "cash" ? <p><span className="text-white/45">Fees:</span> {method.fee_percent}%</p> : null}{method.instructions ? <p className="rounded-2xl bg-white/[0.04] p-4 text-white/65">{method.instructions}</p> : null}</div></div>)}{!methods.length ? <div className="rounded-3xl border border-white/10 bg-black/20 p-6 text-center text-white/55">No methods configured yet.</div> : null}</div></GlassCard></div></SidebarShell>;
}
