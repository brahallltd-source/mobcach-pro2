"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Upload } from "lucide-react";
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
import { CldUploadWidget } from "next-cloudinary";
import { useTranslation } from "@/lib/i18n";

export default function AgentRechargePage() {
  const { t } = useTranslation();
  const [methods, setMethods] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ 
    amount: "1000", 
    admin_method_id: "", 
    note: "", 
    proof_url: "",
    agentEmail: "" 
  });

  const loadData = async () => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return;
    const user = JSON.parse(saved);

    try {
      const [mRes, rRes] = await Promise.all([
        fetch("/api/admin/payment-methods-public"),
        fetch(`/api/agent/topup-requests?agentId=${user.agentId}`)
      ]);
      
      const mData = await mRes.json();
      const rData = await rRes.json();

      setMethods(mData.methods || []);
      setRequests(rData.requests || []);
      setForm(prev => ({ ...prev, agentEmail: user.email }));
    } catch (e) {
      // 🟢 تم التغيير لـ error_loading_failed
      toast.error(t("error_loading_failed") || "Error loading data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const submit = async () => {
    if (!form.admin_method_id || !form.amount || !form.proof_url) {
      // 🟢 تم التغيير لـ recharge_fill_all_fields
      return toast.error(t("recharge_fill_all_fields") || "Please fill all fields");
    }
    
    const saved = localStorage.getItem("mobcash_user");
    const { agentId } = JSON.parse(saved!);

    setSaving(true);
    try {
      const selectedMethod = methods.find(m => m.id === form.admin_method_id);
      const res = await fetch("/api/agent/topup-requests", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          agentId,
          admin_method_name: selectedMethod?.method_name
        })
      });
      const data = await res.json();
      if (data.success) {
        // 🟢 تم التغيير لـ recharge_request_sent
        toast.success(t("recharge_request_sent") || "Request sent successfully");
        loadData();
      } else {
        toast.error(data.message || t("error_failed_to_send"));
      }
    } catch (e) {
      // 🟢 تم التغيير لـ error_network_error
      toast.error(t("error_network_error"));
    } finally {
      setSaving(false);
    }
  };

  // 🟢 تم التغيير لـ loading المباشرة
  if (loading) return <LoadingCard text={t("loading") || "Loading..."} />;

  const selectedMethod = methods.find(m => m.id === form.admin_method_id);

  return (
    <SidebarShell role="agent">
      <PageHeader 
        title={t("recharge_title") || "Recharge Account"} 
        subtitle={t("recharge_subtitle") || "Add balance"} 
      />
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" dir="rtl">
        <GlassCard className="lg:col-span-2 p-6">
          <div className="space-y-6">
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 block">
                {t("recharge_amount_label") || "Amount (DH)"}
              </label>
              <TextField 
                type="number" 
                value={form.amount} 
                onChange={(e: any) => setForm({...form, amount: e.target.value})} 
              />
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 block">
                {t("recharge_method_label") || "Payment Method"}
              </label>
              <SelectField 
                value={form.admin_method_id}
                onChange={(e: any) => setForm({...form, admin_method_id: e.target.value})}
                // @ts-ignore
                options={methods.map(m => ({ label: m.method_name, value: m.id }))}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 block">
                {t("recharge_proof_label") || "Payment Proof"}
              </label>
              <CldUploadWidget 
                uploadPreset="mobcash_preset" 
                onSuccess={(result: any) => {
                  if (result.event === "success") {
                    setForm({...form, proof_url: result.info.secure_url});
                  }
                }}
              >
                {({ open }) => (
                  <button 
                    type="button"
                    onClick={() => open()}
                    className="w-full h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center hover:bg-white/5 transition bg-white/5"
                  >
                    {form.proof_url ? (
                      <div className="flex flex-col items-center">
                        <CheckCircle2 className="text-emerald-500 w-10 h-10 mb-2" />
                        <span className="text-xs text-emerald-500 font-bold">
                          {t("recharge_upload_success")}
                        </span>
                      </div>
                    ) : (
                      <>
                        <Upload className="text-white/40 w-10 h-10 mb-2" />
                        <span className="text-sm text-white/40">
                          {t("recharge_upload_hint")}
                        </span>
                      </>
                    )}
                  </button>
                )}
              </CldUploadWidget>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-white/70 block">
                {t("recharge_note_label") || "Note"}
              </label>
              <TextArea 
                value={form.note} 
                onChange={(e: any) => setForm({...form, note: e.target.value})} 
              />
            </div>

            <PrimaryButton 
              onClick={submit} 
              disabled={saving || !form.proof_url}
              className="w-full"
            >
              {/* 🟢 تم التغيير لـ sending المباشرة */}
              {saving ? t("sending") : t("recharge_submit_btn")}
            </PrimaryButton>
          </div>
        </GlassCard>

        <div className="space-y-6">
          {selectedMethod ? (
            <GlassCard className="p-6 border-emerald-500/20 bg-emerald-500/5">
              <h3 className="font-bold mb-4 text-emerald-400 border-b border-emerald-500/20 pb-2 text-right">
                {t("recharge_payment_details")}
              </h3>
              <div className="space-y-4 text-sm text-white/90">
                <div className="flex justify-between items-center">
                  <span className="text-white/40">{t("accountName")}:</span>
                  <span className="font-bold">{selectedMethod.account_name}</span>
                </div>
                {selectedMethod.rib && (
                  <div className="space-y-1 text-left" dir="ltr">
                    <span className="text-white/40 block text-right">{t("accountNumber")}:</span>
                    <span className="font-mono bg-black/30 p-2 rounded block text-center select-all">{selectedMethod.rib}</span>
                  </div>
                )}
                {selectedMethod.wallet_address && (
                  <div className="space-y-1 text-left" dir="ltr">
                    <span className="text-white/40 block text-right">{t("walletAddress")}:</span>
                    <span className="font-mono bg-black/30 p-2 rounded block text-center text-xs break-all select-all">{selectedMethod.wallet_address}</span>
                  </div>
                )}
              </div>
            </GlassCard>
          ) : (
            <GlassCard className="p-6">
              <p className="text-white/40 text-center text-sm italic">
                {t("recharge_select_method_hint")}
              </p>
            </GlassCard>
          )}
        </div>
      </div>
    </SidebarShell>
  );
}