"use client";

import { useEffect, useState } from "react";
import { Copy, Edit2 } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SelectField, SidebarShell, TextArea, TextField } from "@/components/ui";

type Method = {
  id: string;
  type: "bank" | "crypto" | "cash";
  method_name: string;
  currency: string;
  bank_name?: string;
  account_name?: string;
  rib?: string;
  wallet_address?: string;
  network?: string;
  provider?: string;
  phone?: string;
  city?: string;
  instructions?: string;
  active?: boolean;
};

const EMPTY_FORM: Method = {
  id: "",
  type: "bank",
  method_name: "",
  currency: "MAD",
  bank_name: "",
  account_name: "",
  rib: "",
  wallet_address: "",
  network: "",
  provider: "",
  phone: "",
  city: "",
  instructions: "",
  active: true,
};

export default function AdminPaymentMethodsPage() {
  const [items, setItems] = useState<Method[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Method>({ ...EMPTY_FORM });

  const load = async () => {
    try {
      const res = await fetch("/api/admin/payment-methods", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      setItems(data.methods || []);
    } catch (error) {
      console.error("Failed to load methods:", error);
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const copyText = async (value?: string) => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    alert("Copied successfully");
  };

  const startEdit = (method: Method) => {
    setForm({ ...method });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setForm({ ...EMPTY_FORM });
  };

  const submit = async () => {
    setSaving(true);
    
    // إذا كان هناك ID فهذا يعني أننا نقوم بـ "تحديث"، وإلا فهي "إضافة جديدة"
    const isUpdate = !!form.id;
    const method = isUpdate ? "PUT" : "POST";

    try {
      const res = await fetch("/api/admin/payment-methods", {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.message || "Failed to save method");
        return;
      }
      
      await load();
      setForm({ ...EMPTY_FORM });
      alert(data.message || "Saved successfully");
    } catch (error) {
      console.error(error);
      alert("Network error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (methodId: string, active: boolean) => {
    const res = await fetch("/api/admin/payment-methods", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methodId, active }),
    });
    const data = await res.json();
    if (!res.ok) return alert(data.message || "Failed to update method");
    await load();
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading payment methods..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Admin payment methods"
        subtitle="Create flexible treasury methods for bank, crypto and cash. Agents only see active methods and each type shows the right transfer fields."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-cyan-300">
            {form.id ? "Edit payment method" : "Create payment method"}
          </h2>
          <div className="mt-5 grid gap-4">
            <SelectField value={form.type} onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as Method["type"] }))}>
              <option value="bank">Bank</option>
              <option value="crypto">Crypto</option>
              <option value="cash">Cash</option>
            </SelectField>
            <TextField placeholder="Method name (e.g. CIH Bank)" value={form.method_name} onChange={(e) => setForm((prev) => ({ ...prev, method_name: e.target.value }))} />
            <TextField placeholder="Currency (e.g. MAD)" value={form.currency} onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))} />

            {form.type === "bank" ? (
              <>
                <TextField placeholder="Bank name" value={form.bank_name || ""} onChange={(e) => setForm((prev) => ({ ...prev, bank_name: e.target.value }))} />
                <TextField placeholder="Account name" value={form.account_name || ""} onChange={(e) => setForm((prev) => ({ ...prev, account_name: e.target.value }))} />
                <TextField placeholder="RIB" value={form.rib || ""} onChange={(e) => setForm((prev) => ({ ...prev, rib: e.target.value }))} />
              </>
            ) : null}

            {form.type === "crypto" ? (
              <>
                <TextField placeholder="Wallet address" value={form.wallet_address || ""} onChange={(e) => setForm((prev) => ({ ...prev, wallet_address: e.target.value }))} />
                <TextField placeholder="Network (e.g. TRC20)" value={form.network || ""} onChange={(e) => setForm((prev) => ({ ...prev, network: e.target.value }))} />
              </>
            ) : null}

            {form.type === "cash" ? (
              <>
                <TextField placeholder="Provider (e.g. CashPlus)" value={form.provider || ""} onChange={(e) => setForm((prev) => ({ ...prev, provider: e.target.value }))} />
                <TextField placeholder="Receiver phone" value={form.phone || ""} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
                <TextField placeholder="City" value={form.city || ""} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
              </>
            ) : null}

            <TextArea rows={4} placeholder="Instructions for the agent" value={form.instructions || ""} onChange={(e) => setForm((prev) => ({ ...prev, instructions: e.target.value }))} />
            
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <PrimaryButton onClick={submit} disabled={saving} className="flex-1">
                {saving ? "Saving..." : form.id ? "Update method" : "Save method"}
              </PrimaryButton>
              {form.id && (
                <button 
                  onClick={cancelEdit} 
                  disabled={saving}
                  className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold text-white/80 hover:bg-white/10 transition"
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Treasury methods</h2>
          <div className="mt-5 space-y-4">
            {items.map((item) => (
              <div key={item.id} className={`rounded-3xl border p-5 transition ${form.id === item.id ? 'border-cyan-400/50 bg-cyan-400/5' : 'border-white/10 bg-black/20'}`}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-semibold">{item.method_name}</p>
                      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">{item.type}</span>
                      <span className={`rounded-full px-3 py-1 text-xs uppercase tracking-[0.2em] ${item.active ? "bg-emerald-400/10 text-emerald-200" : "bg-white/10 text-white/60"}`}>{item.active ? "active" : "inactive"}</span>
                    </div>
                    <div className="mt-3 grid gap-2 text-sm text-white/65">
                      <p>Currency: <span className="font-semibold text-white">{item.currency}</span></p>
                      {item.bank_name ? <p>Bank: <span className="font-semibold text-white">{item.bank_name}</span></p> : null}
                      {item.account_name ? <p>Account: <span className="font-semibold text-white">{item.account_name}</span></p> : null}
                      {item.rib ? <p>RIB: <span className="font-semibold text-white">{item.rib}</span></p> : null}
                      {item.wallet_address ? <p className="break-all">Wallet: <span className="font-semibold text-white">{item.wallet_address}</span></p> : null}
                      {item.network ? <p>Network: <span className="font-semibold text-white">{item.network}</span></p> : null}
                      {item.provider ? <p>Provider: <span className="font-semibold text-white">{item.provider}</span></p> : null}
                      {item.phone ? <p>Phone: <span className="font-semibold text-white">{item.phone}</span></p> : null}
                      {item.city ? <p>City: <span className="font-semibold text-white">{item.city}</span></p> : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => startEdit(item)} 
                      className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-300 hover:bg-cyan-500/20 transition"
                    >
                      <Edit2 size={14} className="mr-2 inline-block" />
                      Edit
                    </button>
                    {item.rib ? <button onClick={() => copyText(item.rib)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10"><Copy size={14} className="mr-2 inline-block" />Copy RIB</button> : null}
                    {item.wallet_address ? <button onClick={() => copyText(item.wallet_address)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10"><Copy size={14} className="mr-2 inline-block" />Copy Wallet</button> : null}
                    <button onClick={() => toggleActive(item.id, !item.active)} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80 hover:bg-white/10 transition">
                      {item.active ? "Disable" : "Enable"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!items.length ? <div className="rounded-3xl border border-dashed border-white/10 p-6 text-center text-white/55">No payment methods yet.</div> : null}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}