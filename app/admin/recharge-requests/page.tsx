"use client";

import { useEffect, useState } from "react";
import { Copy, Edit2, Trash2, Plus, CheckCircle2, XCircle } from "lucide-react";
// 🟢 المسمار: استيراد المحرك الجديد
import { useTranslation } from "@/lib/i18n";
import { 
  GlassCard, 
  LoadingCard, 
  PageHeader, 
  PrimaryButton, 
  SelectField, 
  SidebarShell, 
  TextArea, 
  TextField 
} from "@/components/ui";
import { toast } from "react-hot-toast";

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
  const { t } = useTranslation();
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
      console.error(error);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      
      toast.success(t("confirm") || "Saved successfully");
      setForm({ ...EMPTY_FORM });
      load();
    } catch (error: any) {
      toast.error(error.message || "Error saving method");
    } finally {
      setSaving(false);
    }
  };

  const deleteMethod = async (id: string) => {
    if (!confirm("Delete this method?")) return;
    try {
      const res = await fetch(`/api/admin/payment-methods?methodId=${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Deleted");
        load();
      }
    } catch (err) { toast.error("Error"); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    await fetch("/api/admin/payment-methods", {
      method: "PATCH",
      body: JSON.stringify({ methodId: id, active: !current }),
    });
    load();
  };

  if (loading) return <SidebarShell role="admin"><LoadingCard text={t("processing")} /></SidebarShell>;

  return (
    <SidebarShell role="admin">
      <PageHeader
        title={t("paymentMethods")}
        subtitle="Manage Treasury methods. Ensure active methods are visible to agents."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr] mt-6">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-cyan-300">
            {form.id ? t("edit") : t("createNewOrder")}
          </h2>
          <div className="mt-5 grid gap-4">
            <SelectField value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
              <option value="bank">Bank</option>
              <option value="crypto">Crypto</option>
              <option value="cash">Cash</option>
            </SelectField>
            
            <TextField placeholder="Method Name (e.g. CIH Bank)" value={form.method_name} onChange={(e) => setForm({ ...form, method_name: e.target.value })} />
            <TextField placeholder="Currency (MAD/USDT)" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />

            {form.type === "bank" && (
              <>
                <TextField placeholder="Bank Name" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
                <TextField placeholder="Account Name" value={form.account_name} onChange={(e) => setForm({ ...form, account_name: e.target.value })} />
                <TextField placeholder="RIB" value={form.rib} onChange={(e) => setForm({ ...form, rib: e.target.value })} />
              </>
            )}

            {form.type === "crypto" && (
              <>
                <TextField placeholder="Wallet Address" value={form.wallet_address} onChange={(e) => setForm({ ...form, wallet_address: e.target.value })} />
                <TextField placeholder="Network (TRC20...)" value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} />
              </>
            )}

            {form.type === "cash" && (
              <>
                <TextField placeholder="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} />
                <TextField placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </>
            )}

            <TextArea rows={3} placeholder="Instructions for agent" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
            
            <div className="flex gap-3">
              <PrimaryButton onClick={submit} disabled={saving} className="flex-1">
                {saving ? t("processing") : form.id ? t("update") : t("save")}
              </PrimaryButton>
              {form.id && <button onClick={() => setForm({ ...EMPTY_FORM })} className="px-6 py-3 bg-white/5 rounded-2xl">{t("cancel")}</button>}
            </div>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <h2 className="text-2xl font-semibold px-2">{t("paymentMethods")}</h2>
          {items.map((item) => (
            <GlassCard key={item.id} className="p-5 flex justify-between items-center">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-bold text-lg">{item.method_name}</p>
                  <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${item.active ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/10 text-white/40'}`}>
                    {item.active ? t("active") : t("suspended")}
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-1">{item.type} • {item.currency}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setForm(item)} className="p-2 bg-white/5 rounded-xl hover:bg-white/10"><Edit2 size={16}/></button>
                <button onClick={() => deleteMethod(item.id)} className="p-2 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20"><Trash2 size={16}/></button>
                <button onClick={() => toggleActive(item.id, !!item.active)} className="p-2 bg-white/5 rounded-xl">
                  {item.active ? <XCircle size={16}/> : <CheckCircle2 size={16}/>}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </SidebarShell>
  );
}