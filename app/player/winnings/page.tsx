"use client";

import { clsx } from "clsx";
import { useEffect, useMemo, useState } from "react";
// 🟢 المسمار: استعملنا المحرك الجديد والترجمة
import { useTranslation } from "@/lib/i18n";
import { usePlayerTx } from "@/hooks/usePlayerTx";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  SelectField,
  TextField,
} from "@/components/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fetchSessionUser, redirectToLogin } from "@/lib/client-session";
import type { MobcashUser } from "@/lib/mobcash-user-types";

type User = { id: string; email: string; role: string };
type WinningOrder = { id: string; amount: number; gosport365_username?: string; status: string; created_at?: string };
type WithdrawalItem = { id: string; amount: number; method: string; status: string; created_at?: string; cashProvider?: string; gosportUsername?: string };

export default function PlayerWinningsPage() {
  const { t } = useTranslation();
  const tp = usePlayerTx();
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

  const load = async () => {
    try {
      const res = await fetch("/api/player/winnings", {
        cache: "no-store",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        winning?: WinningOrder | null;
        history?: WithdrawalItem[];
      };
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          toast.error(tp("winnings.sessionError"));
        }
        setWinning(null);
        setHistory([]);
        return;
      }
      setWinning(data.winning || null);
      setHistory(Array.isArray(data.history) ? data.history : []);
      if (data.winning?.gosport365_username) {
        setForm((prev) => ({ ...prev, gosportUsername: data.winning!.gosport365_username! }));
      }
    } catch (err) {
      console.error("Load winnings error", err);
      setWinning(null);
      setHistory([]);
    }
  };

  useEffect(() => {
    void (async () => {
      let u = await fetchSessionUser();
      if (!u) {
        await new Promise((r) => setTimeout(r, 200));
        u = await fetchSessionUser();
      }
      const mu = u as MobcashUser | null;
      if (!mu || String(mu.role ?? "").toLowerCase() !== "player") {
        redirectToLogin();
        return;
      }
      try {
        localStorage.setItem("mobcash_user", JSON.stringify(mu));
      } catch {
        /* ignore */
      }
      const current: User = {
        id: mu.id,
        email: mu.email,
        role: mu.role,
      };
      setUser(current);
      await load();
      setLoading(false);
    })();
  }, []);

  const pendingRequest = useMemo(() => history.find((item) => ["pending", "sent"].includes(item.status)), [history]);

  const submit = async () => {
    if (!user) return;
    const amount = Number(form.amount || 0);

    // التحققات (Validation)
    if (!amount || amount <= 0) return toast.error(t("enterAmount"));
    if (!form.gosportUsername.trim() || form.gosportUsername !== form.gosportUsernameConfirm) return toast.error(t("confirmGosportUsername"));
    if (!form.gosportPassword.trim() || form.gosportPassword !== form.gosportPasswordConfirm) {
      return toast.error(tp("winnings.checkPassword"));
    }

    if (method === "bank") {
      if (!form.rib.trim() || form.rib !== form.ribConfirm) return toast.error(tp("winnings.checkRib"));
    } else {
      if (!form.fullName.trim() || !form.phone.trim()) return toast.error(tp("winnings.receiverRequired"));
    }

    try {
      setSaving(true);
      const res = await fetch("/api/player/winnings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
      await load();
      setForm(prev => ({ ...prev, amount: "", gosportPassword: "", gosportPasswordConfirm: "" }));
    } catch (err: any) {
      toast.error(err.message || tp("winnings.submitFailed"));
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

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card className="border-primary/25 bg-white/[0.04] shadow-xl backdrop-blur-md">
          <CardContent className="space-y-2 py-6">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-white/45 text-balance">
              {tp("winnings.availableBalance")}
            </p>
            <p className="text-center text-4xl font-black tabular-nums text-white">
              {winning?.amount || 0}
              <span className="ms-2 text-xl font-semibold text-white/50">DH</span>
            </p>
            <p className="text-center text-xs text-white/40">رصيد الأرباح المسجل</p>
          </CardContent>
        </Card>
        <Card className="border-primary/25 bg-white/[0.04] shadow-xl backdrop-blur-md">
          <CardContent className="flex flex-col justify-center gap-2 py-6">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-white/45 text-balance">
              {tp("winnings.requestStatus")}
            </p>
            <p className="text-center text-2xl font-bold text-white">
              {pendingRequest ? t("processing") : tp("winnings.readyToSend")}
            </p>
            <p className="text-center text-xs text-white/40 text-balance">
              {pendingRequest ? tp("winnings.pendingCaption") : tp("winnings.canSubmitNew")}
            </p>
          </CardContent>
        </Card>
        <Card className="border-primary/25 bg-white/[0.04] shadow-xl backdrop-blur-md">
          <CardContent className="flex flex-col justify-center gap-2 py-6">
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-white/45">تاريخ العمليات</p>
            <p className="text-center text-3xl font-black tabular-nums text-white">{String(history.length)}</p>
            <p className="text-center text-xs text-white/40 text-balance">{tp("winnings.historyCountCaption")}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr] mt-8">
        <GlassCard className="border-primary/25 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md md:p-8">
          <h2 className="text-2xl font-semibold text-white">التصريح بربح جديد / طلب سحب</h2>

          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-white/60">{t("amount")} (DH)</label>
              <TextField
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder={tp("winnings.amountPlaceholder")}
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
                placeholder={tp("winnings.gosportPassword")}
              />
              <TextField
                type="password"
                value={form.gosportPasswordConfirm}
                onChange={(e) => setForm({ ...form, gosportPasswordConfirm: e.target.value })}
                placeholder="Confirm Password"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setMethod("bank")}
                className={clsx(
                  "h-auto min-h-[88px] w-full flex-col items-stretch gap-1 rounded-2xl border-primary/30 p-4 text-start hover:bg-white/[0.06]",
                  method === "bank" && "border-cyan-400/55 bg-cyan-500/15 shadow-lg ring-2 ring-cyan-400/35"
                )}
              >
                <span className="text-base font-bold text-white">{tp("winnings.bankTransfer")}</span>
                <span className="text-xs font-normal text-white/50">{tp("winnings.bankTransferHint")}</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setMethod("cash")}
                className={clsx(
                  "h-auto min-h-[88px] w-full flex-col items-stretch gap-1 rounded-2xl border-primary/30 p-4 text-start hover:bg-white/[0.06]",
                  method === "cash" && "border-cyan-400/55 bg-cyan-500/15 shadow-lg ring-2 ring-cyan-400/35"
                )}
              >
                <span className="text-base font-bold text-white">{tp("winnings.cashWithdraw")}</span>
                <span className="text-xs font-normal text-white/50">{tp("winnings.cashWithdrawHint")}</span>
              </Button>
            </div>

            {method === "bank" ? (
              <div className="grid gap-4 md:grid-cols-2">
                <TextField value={form.rib} onChange={(e) => setForm({ ...form, rib: e.target.value })} placeholder="RIB" />
                <TextField value={form.ribConfirm} onChange={(e) => setForm({ ...form, ribConfirm: e.target.value })} placeholder="Confirm RIB" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <SelectField value={form.cashProvider} onChange={(e) => setForm({ ...form, cashProvider: e.target.value })}>
                  <option>Cash Express</option>
                  <option>Cash Plus</option>
                  <option>Wafacash</option>
                </SelectField>
                <TextField
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder={tp("winnings.fullName")}
                />
                <TextField
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder={tp("winnings.phone")}
                />
                <TextField
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder={tp("winnings.city")}
                />
              </div>
            )}

            <PrimaryButton onClick={submit} disabled={saving} className="w-full">
              {saving ? t("processing") : tp("winnings.submitCta")}
            </PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="border-primary/25 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md md:p-8">
          <h2 className="text-2xl font-semibold text-white">{t("myOrders")}</h2>
          <div className="mt-6 space-y-4">
            {history.map((item) => (
              <Card
                key={item.id}
                className="border-primary/20 bg-white/[0.03] shadow-md backdrop-blur-sm"
              >
                <CardContent className="flex flex-row items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="text-xl font-black tabular-nums text-white">
                      {item.amount} <span className="text-sm font-semibold text-white/50">DH</span>
                    </p>
                    <p className="mt-1 text-xs text-white/45">
                      {item.method} • {item.status}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white/80">
                    {item.status}
                  </span>
                </CardContent>
              </Card>
            ))}
            {!history.length ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-muted/10 p-10 text-center text-sm text-white/40">
                {t("noOffers")}
              </div>
            ) : null}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}