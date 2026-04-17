"use client";

import { useEffect, useMemo, useState } from "react";
import { ImagePlus, Wallet as WalletIcon, ListChecks, Clock, CheckCircle2 } from "lucide-react";
import { clsx } from "clsx";
import { useTranslation } from "@/lib/i18n";
import { 
  GlassCard, 
  LoadingCard, 
  PageHeader, 
  PrimaryButton, 
  SelectField, 
  SidebarShell, 
  StatCard, 
  TextArea, 
  TextField 
} from "@/components/ui";
import { toast } from "react-hot-toast";

type User = { role: string; email: string; agentId?: string };
type Wallet = { balance: number };
type AdminMethod = { 
  id: string; 
  type: string; 
  method_name: string; 
  currency: string; 
  account_name?: string; 
  rib?: string; 
  wallet_address?: string; 
  network?: string; 
  phone?: string; 
};
type TopupRequest = { 
  id: string; 
  amount: number; 
  admin_method_name: string; 
  status: string; 
  created_at: string; 
  note?: string; 
  bonus_amount?: number; 
  gosport365_username?: string 
};

export default function AgentRechargePage() {
  const { t } = useTranslation(); // 🟢 تفعيل الترجمة
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [methods, setMethods] = useState<AdminMethod[]>([]);
  const [requests, setRequests] = useState<TopupRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [proofFile, setProofFile] = useState<File | null>(null);
  
  const [form, setForm] = useState({ 
    amount: "1000", 
    admin_method_id: "", 
    note: "",
    gosport365_username: "",
    confirm_gosport365_username: ""
  });

  const loadData = async (agentId: string) => {
    try {
      // 🟢 تأكد بلي هاد المسار "/api/admin/payment-methods" كيرجع الطرق للوكيل
      const [walletRes, methodsRes, requestsRes] = await Promise.all([
        fetch(`/api/agent/wallet?agentId=${encodeURIComponent(agentId)}`).then(res => res.json()),
        fetch(`/api/admin/payment-methods`).then(res => res.json()), // جلب طرق دفع الآدمين
        fetch(`/api/agent/topup-requests?agentId=${encodeURIComponent(agentId)}`).then(res => res.json()),
      ]);

      setWallet(walletRes.wallet || null);
      setMethods(methodsRes.methods || []);
      setRequests((requestsRes.requests || []).sort((a: any, b: any) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));

      if (!form.admin_method_id && (methodsRes.methods || []).length > 0) {
        setForm(prev => ({ ...prev, admin_method_id: methodsRes.methods[0].id }));
      }
    } catch (err) {
      console.error("Failed to load recharge data", err);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: User = JSON.parse(saved);
    if (current.role !== "agent") return void (window.location.href = "/login");
    setUser(current);
    if (current.agentId) {
      loadData(current.agentId).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const selectedMethod = methods.find((item) => item.id === form.admin_method_id);
  const approvedCount = requests.filter(i => i.status === "approved").length;
  const pendingCount = requests.filter(i => i.status === "pending").length;

  const isFormInvalid = useMemo(() => {
    if (!form.amount || Number(form.amount) <= 0) return true;
    if (!form.gosport365_username || form.gosport365_username !== form.confirm_gosport365_username) return true;
    if (selectedMethod?.type !== "crypto" && !proofFile) return true;
    return false;
  }, [form, selectedMethod, proofFile]);

  const submit = async () => {
    if (!user?.agentId || isFormInvalid) return;
    setSaving(true);

    let proofData = { url: "", hash: "" };
    if (selectedMethod?.type !== "crypto" && proofFile) {
      const body = new FormData();
      body.append("file", proofFile);
      body.append("actorEmail", user.email);
      body.append("context", "agent_topup");
      const res = await fetch("/api/upload-transaction-proof", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.message || "Upload failed");
        setSaving(false);
        return;
      }
      proofData = { url: data.proof.url, hash: data.proof.hash };
    }

    const res = await fetch("/api/agent/topup-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agentId: user.agentId,
        amount: Number(form.amount),
        admin_method_id: selectedMethod?.id,
        admin_method_name: selectedMethod?.method_name,
        proof_url: proofData.url,
        proof_hash: proofData.hash,
        note: form.note,
        gosport365_username: form.gosport365_username,
      }),
    });

    if (res.ok) {
      toast.success(t("orderSend"));
      setForm(prev => ({ ...prev, amount: "1000", note: "", gosport365_username: "", confirm_gosport365_username: "" }));
      setProofFile(null);
      loadData(user.agentId);
    } else {
      toast.error("Failed to send request");
    }
    setSaving(false);
  };

  if (loading) return <SidebarShell role="agent"><LoadingCard text={t("processing")} /></SidebarShell>;

  return (
    <SidebarShell role="agent">
      <PageHeader
        title={t("recharge")}
        subtitle={t("heroBody")}
      />

      <div className="grid gap-4 md:grid-cols-4 mt-6">
        <StatCard label={t("available")} value={`${wallet?.balance || 0} DH`} icon={<WalletIcon size={18}/>} />
        <StatCard label={t("methods")} value={String(methods.length)} icon={<ListChecks size={18}/>} />
        <StatCard label={t("all")} value={String(pendingCount)} hint="Pending" icon={<Clock size={18}/>} />
        <StatCard label={t("confirm")} value={String(approvedCount)} hint="Approved" icon={<CheckCircle2 size={18}/>} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr] mt-8">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white">{t("createNewOrder")}</h2>
          <div className="mt-6 space-y-4">
            
            <div className="grid gap-4 md:grid-cols-2">
              <TextField 
                value={form.gosport365_username} 
                onChange={(e) => setForm(p => ({ ...p, gosport365_username: e.target.value }))} 
                placeholder={t("gosportUsername")} 
              />
              <TextField 
                value={form.confirm_gosport365_username} 
                onChange={(e) => setForm(p => ({ ...p, confirm_gosport365_username: e.target.value }))} 
                placeholder={t("confirmGosportUsername")} 
              />
            </div>

            <TextField type="number" value={form.amount} onChange={(e) => setForm(p => ({ ...p, amount: e.target.value }))} placeholder={t("amount")} />
            
            <SelectField value={form.admin_method_id} onChange={(e) => setForm(p => ({ ...p, admin_method_id: e.target.value }))}>
              {methods.length === 0 && <option>No methods available</option>}
              {methods.map((item) => <option key={item.id} value={item.id}>{item.method_name}</option>)}
            </SelectField>

            {selectedMethod && (
              <div className="rounded-3xl border border-white/10 bg-black/20 p-5 text-sm">
                <p className="text-xs uppercase tracking-widest text-white/30 font-bold mb-3">{t("transferInstructions")}</p>
                <div className="space-y-2 text-white/80">
                  {selectedMethod.account_name && <p>{t("accountName")}: <span className="text-white font-bold">{selectedMethod.account_name}</span></p>}
                  {selectedMethod.rib && <p>RIB: <span className="text-cyan-400 font-mono select-all">{selectedMethod.rib}</span></p>}
                  {selectedMethod.wallet_address && <p>Address: <span className="text-cyan-400 break-all select-all font-mono">{selectedMethod.wallet_address}</span></p>}
                </div>
              </div>
            )}

            {selectedMethod?.type !== "crypto" && (
              <div className="rounded-3xl border border-dashed border-white/10 p-5">
                <p className="text-sm font-semibold mb-3">{t("uploadProof")}</p>
                <label className="flex cursor-pointer items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 py-4 text-sm transition hover:bg-white/10">
                  <ImagePlus size={16} />
                  {proofFile ? proofFile.name : t("uploadProof")}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => setProofFile(e.target.files?.[0] || null)} />
                </label>
              </div>
            )}

            <TextArea rows={3} value={form.note} onChange={(e) => setForm(p => ({ ...p, note: e.target.value }))} placeholder={t("notesOptional")} />

            <PrimaryButton onClick={submit} disabled={saving || isFormInvalid} className="w-full">
              {saving ? t("processing") : t("createOrder")}
            </PrimaryButton>
          </div>
        </GlassCard>

        {/* سجل الطلبات */}
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white">{t("myOrders")}</h2>
          <div className="mt-6 space-y-4">
            {requests.map((item) => (
              <div key={item.id} className="rounded-3xl border border-white/10 bg-black/20 p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-bold text-white">{item.amount} DH</p>
                    <p className="text-xs text-white/40">{item.admin_method_name} • {new Date(item.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className={clsx(
                    "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
                    item.status === 'pending' ? 'bg-amber-500/10 text-amber-500' : 'bg-emerald-500/10 text-emerald-500'
                  )}>
                    {item.status}
                  </div>
                </div>
              </div>
            ))}
            {!requests.length && <div className="p-10 text-center text-white/20 italic">{t("noOffers")}</div>}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}