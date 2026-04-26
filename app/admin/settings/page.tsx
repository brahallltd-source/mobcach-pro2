"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextArea,
  TextField,
} from "@/components/ui";
import { toast } from "sonner";
import { useTranslation } from "@/lib/i18n";

type SettingsState = {
  bonusPercentage: string;
  minRechargeAmount: string;
  affiliateBonusEnabled: boolean;
  maxWithdrawalAmount: string;
  usdtToMadRate: string;
  isMaintenance: boolean;
  announcement: string;
};

export default function AdminSystemSettingsPage() {
  const { tx } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SettingsState>({
    bonusPercentage: "10",
    minRechargeAmount: "1000",
    affiliateBonusEnabled: true,
    maxWithdrawalAmount: "100000",
    usdtToMadRate: "10.5",
    isMaintenance: false,
    announcement: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system-settings", { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        toast.error(String(j.message || tx("admin.settings.loadError")));
        return;
      }
      setForm({
        bonusPercentage: String(j.bonusPercentage ?? 10),
        minRechargeAmount: String(j.minRechargeAmount ?? 1000),
        affiliateBonusEnabled: Boolean(j.affiliateBonusEnabled ?? true),
        maxWithdrawalAmount: String(j.maxWithdrawalAmount ?? 100000),
        usdtToMadRate: String(j.usdtToMadRate ?? 10.5),
        isMaintenance: Boolean(j.isMaintenance),
        announcement: String(j.announcement ?? ""),
      });
    } catch {
      toast.error(tx("admin.settings.loadError"));
    } finally {
      setLoading(false);
    }
  }, [tx]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const pct = parseFloat(form.bonusPercentage.trim());
    if (!Number.isFinite(pct) || pct < 0 || pct > 1000) {
      toast.error(tx("admin.settings.bonusPctInvalid"));
      return;
    }
    const minRecharge = parseFloat(String(form.minRechargeAmount).trim());
    if (!Number.isFinite(minRecharge) || minRecharge < 1 || minRecharge > 10_000_000) {
      toast.error(tx("admin.settings.minRechargeInvalid"));
      return;
    }
    const maxWithdrawal = parseFloat(String(form.maxWithdrawalAmount).trim());
    if (!Number.isFinite(maxWithdrawal) || maxWithdrawal < 100 || maxWithdrawal > 50_000_000) {
      toast.error(tx("admin.settings.maxWithdrawInvalid"));
      return;
    }
    const usdtRate = parseFloat(String(form.usdtToMadRate).trim());
    if (!Number.isFinite(usdtRate) || usdtRate < 0.01 || usdtRate > 10_000) {
      toast.error(tx("admin.settings.usdtRateInvalid"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/system-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bonusPercentage: pct,
          minRechargeAmount: minRecharge,
          affiliateBonusEnabled: form.affiliateBonusEnabled,
          maxWithdrawalAmount: maxWithdrawal,
          usdtToMadRate: usdtRate,
          isMaintenance: form.isMaintenance,
          announcement: form.announcement,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(String(j.message || tx("admin.settings.saveError")));
        return;
      }
      setForm({
        bonusPercentage: String(j.bonusPercentage ?? pct),
        minRechargeAmount: String(j.minRechargeAmount ?? minRecharge),
        affiliateBonusEnabled: Boolean(j.affiliateBonusEnabled ?? form.affiliateBonusEnabled),
        maxWithdrawalAmount: String(j.maxWithdrawalAmount ?? maxWithdrawal),
        usdtToMadRate: String(j.usdtToMadRate ?? usdtRate),
        isMaintenance: Boolean(j.isMaintenance),
        announcement: String(j.announcement ?? ""),
      });
      toast.success(tx("admin.settings.saveSuccess"));
    } catch {
      toast.error(tx("admin.settings.saveError"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text={tx("admin.settings.loading")} />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader title={tx("admin.settings.pageTitle")} subtitle={tx("admin.settings.pageSubtitle")} />

      <GlassCard className="mt-6 max-w-2xl space-y-5 p-6">
        <div className="border-b border-white/10 pb-5">
          <h2 className="mb-3 text-sm font-bold text-white">{tx("admin.settings.sectionAdvanced")}</h2>
          <label className="mb-1 block text-xs font-medium text-white/60">{tx("admin.settings.minRechargeLabel")}</label>
          <TextField
            type="number"
            inputMode="decimal"
            min={1}
            step="any"
            dir="ltr"
            value={form.minRechargeAmount}
            onChange={(e) => setForm((f) => ({ ...f, minRechargeAmount: e.target.value }))}
            className="max-w-xs"
          />
          <p className="mt-1 text-xs text-white/40">{tx("admin.settings.minRechargeHint")}</p>

          <label className="mt-4 flex cursor-pointer items-start gap-3 text-sm text-white/85">
            <input
              type="checkbox"
              checked={form.affiliateBonusEnabled}
              onChange={(e) =>
                setForm((f) => ({ ...f, affiliateBonusEnabled: e.target.checked }))
              }
              className="mt-1"
            />
            <span>
              <span className="font-semibold text-white">{tx("admin.settings.affiliateMergeLabel")}</span>
              <span className="block text-xs text-white/45">{tx("admin.settings.affiliateMergeHint")}</span>
            </span>
          </label>

          <label className="mt-4 mb-1 block text-xs font-medium text-white/60">
            {tx("admin.settings.maxWithdrawLabel")}
          </label>
          <TextField
            type="number"
            inputMode="decimal"
            min={100}
            step="any"
            dir="ltr"
            value={form.maxWithdrawalAmount}
            onChange={(e) => setForm((f) => ({ ...f, maxWithdrawalAmount: e.target.value }))}
            className="max-w-xs"
          />
          <p className="mt-1 text-xs text-white/40">{tx("admin.settings.maxWithdrawHint")}</p>

          <label className="mt-4 mb-1 block text-xs font-medium text-white/60">
            {tx("admin.settings.usdtRateLabel")}
          </label>
          <TextField
            type="number"
            inputMode="decimal"
            min={0.01}
            step="0.01"
            dir="ltr"
            value={form.usdtToMadRate}
            onChange={(e) => setForm((f) => ({ ...f, usdtToMadRate: e.target.value }))}
            className="max-w-xs"
          />
          <p className="mt-1 text-xs text-white/40">{tx("admin.settings.usdt_rate")}</p>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/60">{tx("admin.settings.bonusPctLabel")}</label>
          <TextField
            type="number"
            inputMode="decimal"
            min={0}
            max={1000}
            step="any"
            dir="ltr"
            value={form.bonusPercentage}
            onChange={(e) => setForm((f) => ({ ...f, bonusPercentage: e.target.value }))}
            className="max-w-xs"
          />
          <p className="mt-1 text-xs text-white/40">{tx("admin.settings.bonusPctHint")}</p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-white/85">
          <input
            type="checkbox"
            checked={form.isMaintenance}
            onChange={(e) => setForm((f) => ({ ...f, isMaintenance: e.target.checked }))}
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-white">{tx("admin.settings.maintenanceLabel")}</span>
            <span className="block text-xs text-white/45">{tx("admin.settings.maintenanceHint")}</span>
          </span>
        </label>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/60">{tx("admin.settings.announcementLabel")}</label>
          <TextArea
            rows={5}
            dir="auto"
            placeholder={tx("admin.settings.announcementPlaceholder")}
            value={form.announcement}
            onChange={(e) => setForm((f) => ({ ...f, announcement: e.target.value }))}
          />
          <p className="mt-1 text-xs text-white/40">{tx("admin.settings.announcementHint")}</p>
        </div>

        <PrimaryButton type="button" onClick={() => void save()} disabled={saving}>
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {tx("admin.settings.saving")}
            </span>
          ) : (
            tx("admin.settings.saveButton")
          )}
        </PrimaryButton>
      </GlassCard>
    </SidebarShell>
  );
}
