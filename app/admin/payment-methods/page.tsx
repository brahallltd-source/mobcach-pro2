"use client";

import { useEffect, useState } from "react";
import { Edit2, Trash2, CheckCircle2, XCircle } from "lucide-react";
import { GlassCard, LoadingCard, PageHeader, PrimaryButton, SelectField, SidebarShell, TextArea, TextField } from "@/components/ui";
import { toast } from "react-hot-toast";

type Method = {
  id: string;
  type: "bank" | "crypto" | "cash";
  method_name: string;
  currency: string;
  account_name?: string;
  rib?: string;
  wallet_address?: string;
  network?: string;
  provider?: string;
  phone?: string;
  instructions?: string;
  active?: boolean;
};

const EMPTY_FORM: Method = {
  id: "",
  type: "bank",
  method_name: "",
  currency: "MAD",
  account_name: "",
  rib: "",
  wallet_address: "",
  network: "",
  provider: "",
  phone: "",
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
      const res = await fetch("/api/admin/payment-methods", { cache: "no-store" });
      const data = await res.json();
      setItems(data.methods || []);
    } catch (error) {
      toast.error("Failed to load methods");
    }
  };

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  const submit = async () => {
    if (!form.method_name) return toast.error("Method name is required");
    setSaving(true);
    const method = form.id ? "PUT" : "POST";
    try {
      const res = await fetch("/api/admin/payment-methods", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        toast.success("Saved successfully");
        setForm({ ...EMPTY_FORM });
        load();
      }
    } catch (error) {
      toast.error("Error saving method");
    } finally {
      setSaving(false);
    }
  };

  const deleteMethod = async (id: string) => {
    if (!confirm("Delete this method?")) return;
    await fetch(`/api/admin/payment-methods?methodId=${id}`, { method: "DELETE" });
    load();
  };

  const toggleActive = async (id: string, current: boolean) => {
    await fetch("/api/admin/payment-methods", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ methodId: id, active: !current }),
    });
    load();
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text="Loading..." /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader title="Treasury Methods" subtitle="Manage methods visible to agents." />
      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] mt-6">
        <GlassCard className="p-6">
          <h2 className="text-xl font-bold text-cyan-400 mb-4">{form.id ? "Edit Method" : "Create New Method"}</h2>
          <div className="grid gap-4">
            <SelectField value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
              <option value="bank">Bank</option>
              <option value="crypto">Crypto</option>
              <option value="cash">Cash</option>
            </SelectField>
            <TextField placeholder="Method Name" value={form.method_name} onChange={(e) => setForm({ ...form, method_name: e.target.value })} />
            <TextField placeholder="Currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            {form.type === 'bank' && (
              <>
                <TextField placeholder="Account Name" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
                <TextField placeholder="RIB" value={form.rib} onChange={(e) => setForm({ ...form, rib: e.target.value })} />
              </>
            )}
            {form.type === 'crypto' && (
              <>
                <TextField placeholder="Wallet Address" value={form.wallet_address} onChange={(e) => setForm({ ...form, wallet_address: e.target.value })} />
                <TextField placeholder="Network" value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} />
              </>
            )}
            <TextArea placeholder="Instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            <PrimaryButton onClick={submit} disabled={saving}>{saving ? "Saving..." : "Save Method"}</PrimaryButton>
          </div>
        </GlassCard>

        <div className="space-y-4">
          {items.map(item => (
            <GlassCard key={item.id} className="p-4 flex justify-between items-center">
              <div>
                <p className="font-bold">{item.method_name}</p>
                <p className="text-xs text-white/40">{item.type} • {item.currency}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForm(item)} className="p-2 bg-white/5 rounded-lg"><Edit2 size={16}/></button>
                <button onClick={() => deleteMethod(item.id)} className="p-2 bg-rose-500/10 text-rose-400 rounded-lg"><Trash2 size={16}/></button>
                <button onClick={() => toggleActive(item.id, !!item.active)} className="p-2 bg-white/5 rounded-lg">
                  {item.active ? <CheckCircle2 size={16} className="text-emerald-400"/> : <XCircle size={16}/>}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </SidebarShell>
  );
}