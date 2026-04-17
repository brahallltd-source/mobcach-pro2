"use client";

import { useEffect, useMemo, useState } from "react";
// 🟢 المسمار: استعملنا المحرك الجديد والترجمة
import { useTranslation } from "@/lib/i18n";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  StatCard,
  TextField,
} from "@/components/ui";
import { toast } from "react-hot-toast";

type User = { id: string; email: string; role: string };
type WinningOrder = { id: string; amount: number; gosport365_username?: string; status: string; created_at?: string };
type WithdrawalItem = { id: string; amount: number; method: string; status: string; created_at?: string; cashProvider?: string; gosportUsername?: string };

export default function PlayerWinningsPage() {
  const { t } = useTranslation(); // 🟢 تفعيل الترجمة
  const [user, setUser] = useState<User | null>(null);
  const [winning, setWinning] = useState<WinningOrder | null>(null);
  const [history, setHistory] = useState<WithdrawalItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [method, setMethod] = useState<"bank" | "cash">("bank");

  const [form, setForm] = useState({
    amount: "",
    rib: "",
    ribConfirm: "",
    swift: "",
    swiftConfirm: "",
    cashProvider: "Cash Express",
    fullName: "",
    phone: "",
    city: "",
    gosportUsername: "",
    gosportUsernameConfirm: "",
    gosportPassword: "",
    gosportPasswordConfirm: "",
  });

  const load = async (email: string) => {
    try {
      const res = await fetch(`/api/player/winnings?playerEmail=${encodeURIComponent(email)}`, { cache: "no-store" });
      const data = await res.json();
      setWinning(data.winning || null);
      setHistory(data.history || []);
      if (data.winning?.gosport365_username) {
        setForm((prev) => ({ ...prev, gosportUsername: data.winning.gosport365_username }));
      }
    } catch (err) {
      console.error("Load winnings error", err);
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobcash_user");
    if (!saved) return void (window.location.href = "/login");
    const current: User = JSON.parse(saved);
    if (current.role !== "player") return void (window.location.href = "/login");
    setUser(current);
    load(current.email).finally(() => setLoading(false));
  }, []);

  const pendingRequest = useMemo(() => history.find((item) => ["pending", "sent"].includes(item.status)), [history]);

  const submit = async () => {
    if (!user) return;
    const amount = Number(form.amount || 0);

    // التحققات (Validation)
    if (!amount || amount <= 0) return toast.error(t("enterAmount"));
    if (!form.gosportUsername.trim() || form.gosportUsername !== form.gosportUsernameConfirm) return toast.error(t("confirmGosportUsername"));
    if (!form.gosportPassword.trim() || form.gosportPassword !== form.gosportPasswordConfirm) return toast.error("Check GoSport password");

    if (method === "bank") {
      if (!form.rib.trim() || form.rib !== form.ribConfirm) return toast.error("Check RIB confirmation");
    } else {
      if (!form.fullName.trim() || !form.phone.trim()) return toast.error("Receiver details required");
    }

    try {
      setSaving(true);
      const res = await fetch("/api/player/winnings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerEmail: user.email,
          amount,
          method,
          gosportUsername: form.gosportUsername,
          gosportPassword: form.gosportPassword,
          rib: form.rib,
          swift: form.swift,
          cashProvider: form.cashProvider,
          fullName: form.fullName,
          phone: form.phone,
          city: form.city,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      toast.success(t("orderSend"));
      load(user.email);
      setForm(prev => ({ ...prev, amount: "", gosportPassword: "", gosportPasswordConfirm: "" }));
    } catch (err: any) {
      toast.error(err.message || "Failed to submit");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user) return <SidebarShell role="player"><LoadingCard text={t("processing")} /></SidebarShell>;

  return (
    <SidebarShell role="player">
      <PageHeader
        title={t("winnings")}
        subtitle="صرّح بأرباحك في GoSport365 وأدخل معلومات السحب ليتوصل بها الآدمين مباشرة."
      />

      <div className="grid gap-4 md:grid-cols-3 mt-6">
        <StatCard
          label="الرصيد المتاح"
          value={`${winning?.amount || 0} DH`}
          hint="رصيد الأرباح المسجل"
        />
        <StatCard
          label="حالة الطلب"
          value={pendingRequest ? t("processing") : "جاهز للإرسال"}
          hint={pendingRequest ? "طلبك قيد المراجعة لدى الإدارة" : "يمكنك تقديم طلب جديد"}
        />
        <StatCard
          label="تاريخ العمليات"
          value={String(history.length)}
          hint="عدد طلبات السحب السابقة"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] mt-8">
        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white">التصريح بربح جديد / طلب سحب</h2>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60">{t("amount")} (DH)</label>
              <TextField
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="أدخل مبلغ الربح الذي تريد سحبه"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                value={form.gosportUsername}
                onChange={(e) => setForm({ ...form, gosportUsername: e.target.value })}
                placeholder={t("gosportUsername")}
              />
              <TextField
                value={form.gosportUsernameConfirm}
                onChange={(e) => setForm({ ...form, gosportUsernameConfirm: e.target.value })}
                placeholder={t("confirmGosportUsername")}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                type="password"
                value={form.gosportPassword}
                onChange={(e) => setForm({ ...form, gosportPassword: e.target.value })}
                placeholder="GoSport365 Password"
              />
              <TextField
                type="password"
                value={form.gosportPasswordConfirm}
                onChange={(e) => setForm({ ...form, gosportPasswordConfirm: e.target.value })}
                placeholder="Confirm Password"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <button
                onClick={() => setMethod("bank")}
                className={`rounded-2xl border p-4 text-left transition ${
                  method === "bank" ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 bg-black/20"
                }`}
              >
                <div className="font-bold">تحويل بنكي</div>
                <p className="text-xs text-white/50 mt-1">RIB / SWIFT</p>
              </button>
              <button
                onClick={() => setMethod("cash")}
                className={`rounded-2xl border p-4 text-left transition ${
                  method === "cash" ? "border-cyan-400/50 bg-cyan-400/10" : "border-white/10 bg-black/20"
                }`}
              >
                <div className="font-bold">سحب نقدي (Cash)</div>
                <p className="text-xs text-white/50 mt-1">وكالات تحويل الأموال</p>
              </button>
            </div>

            {method === "bank" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <TextField value={form.rib} onChange={(e) => setForm({ ...form, rib: e.target.value })} placeholder="RIB" />
                <TextField value={form.ribConfirm} onChange={(e) => setForm({ ...form, ribConfirm: e.target.value })} placeholder="Confirm RIB" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <select 
                  value={form.cashProvider} 
                  onChange={(e) => setForm({ ...form, cashProvider: e.target.value })}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm"
                >
                  <option>Cash Express</option>
                  <option>Cash Plus</option>
                  <option>Wafacash</option>
                </select>
                <TextField value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Full Name" />
                <TextField value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" />
                <TextField value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
              </div>
            )}

            <PrimaryButton onClick={submit} disabled={saving} className="w-full">
              {saving ? t("processing") : "إرسال تصريح بالربح للآدمين"}
            </PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold text-white">{t("myOrders")}</h2>
          <div className="mt-6 space-y-4">
            {history.map((item) => (
              <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4 flex justify-between items-center">
                <div>
                  <p className="font-bold">{item.amount} DH</p>
                  <p className="text-xs text-white/40">{item.method} • {item.status}</p>
                </div>
                <div className="text-[10px] uppercase font-bold px-2 py-1 rounded-lg bg-white/5 border border-white/10">
                  {item.status}
                </div>
              </div>
            ))}
            {!history.length && <div className="text-center text-white/20 italic p-10">{t("noOffers")}</div>}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}