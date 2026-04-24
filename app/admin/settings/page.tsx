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
import { useToast } from "@/components/toast";

type SettingsState = {
  bonusPercentage: string;
  isMaintenance: boolean;
  announcement: string;
};

export default function AdminSystemSettingsPage() {
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SettingsState>({
    bonusPercentage: "10",
    isMaintenance: false,
    announcement: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/system-settings", { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        showToast({ type: "error", title: String(j.message || "تعذّر تحميل الإعدادات") });
        return;
      }
      setForm({
        bonusPercentage: String(j.bonusPercentage ?? 10),
        isMaintenance: Boolean(j.isMaintenance),
        announcement: String(j.announcement ?? ""),
      });
    } catch {
      showToast({ type: "error", title: "تعذّر تحميل الإعدادات" });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    const pct = parseFloat(form.bonusPercentage.trim());
    if (!Number.isFinite(pct) || pct < 0 || pct > 1000) {
      showToast({ type: "error", title: "نسبة البونص يجب أن تكون رقماً بين 0 و 1000" });
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
          isMaintenance: form.isMaintenance,
          announcement: form.announcement,
        }),
      });
      const j = await res.json();
      if (!res.ok) {
        showToast({ type: "error", title: String(j.message || "فشل الحفظ") });
        return;
      }
      setForm({
        bonusPercentage: String(j.bonusPercentage ?? pct),
        isMaintenance: Boolean(j.isMaintenance),
        announcement: String(j.announcement ?? ""),
      });
      showToast({ type: "success", title: "تم حفظ إعدادات المنصّة" });
    } catch {
      showToast({ type: "error", title: "فشل الحفظ" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="جاري تحميل الإعدادات..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="إعدادات المنصّة"
        subtitle="نسبة بونص الشحن والتعديل اليدوي، وضع الصيانة (يمنع دخول الوكلاء وطلبات الشحن/إضافة اللاعبين)، والإعلان يظهر في لوحة الوكيل."
      />

      <GlassCard className="mt-6 max-w-2xl space-y-5 p-6">
        <div>
          <label className="mb-1 block text-xs font-medium text-white/60">نسبة البونص اليدوي (%)</label>
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
          <p className="mt-1 text-xs text-white/40">
            تُستخدم لطلبات شحن المحفظة وللتعديل اليدوي للرصيد عند تفعيل البونص التلقائي (إضافة فقط). الافتراضي
            10%.
          </p>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm text-white/85">
          <input
            type="checkbox"
            checked={form.isMaintenance}
            onChange={(e) => setForm((f) => ({ ...f, isMaintenance: e.target.checked }))}
            className="mt-1"
          />
          <span>
            <span className="font-semibold text-white">وضع الصيانة</span>
            <span className="block text-xs text-white/45">
              عند التفعيل: لا يمكن للوكلاء تسجيل الدخول، ولا إنشاء طلبات شحن أو إضافة لاعبين (403 من الخادم).
            </span>
          </span>
        </label>

        <div>
          <label className="mb-1 block text-xs font-medium text-white/60">إعلان للوكلاء (Announcement)</label>
          <TextArea
            rows={5}
            dir="auto"
            placeholder="مثال: صيانة مجدولة يوم الجمعة من 22:00 إلى 23:00…"
            value={form.announcement}
            onChange={(e) => setForm((f) => ({ ...f, announcement: e.target.value }))}
          />
          <p className="mt-1 text-xs text-white/40">
            تظهر أعلى لوحة تحكم الوكيل عندما يكون الحقل غير فارغ.
          </p>
        </div>

        <PrimaryButton type="button" onClick={() => void save()} disabled={saving}>
          {saving ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              جاري الحفظ…
            </span>
          ) : (
            "حفظ الإعدادات"
          )}
        </PrimaryButton>
      </GlassCard>
    </SidebarShell>
  );
}
