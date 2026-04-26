"use client";

import { Loader2, Megaphone, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  GlassCard,
  LoadingCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextArea,
} from "@/components/ui";

type Active = { id: string; message: string; createdAt: string } | null;

export default function AdminBroadcastPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [active, setActive] = useState<Active>(null);
  const [draft, setDraft] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/broadcast", { credentials: "include", cache: "no-store" });
      const j = await res.json();
      if (!res.ok) {
        toast.error(String(j.message || "تعذّر تحميل البث"));
        return;
      }
      const a = j.active as Active;
      setActive(a);
      setDraft(a?.message ?? "");
    } catch {
      toast.error("تعذّر تحميل البث");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const publish = async () => {
    const message = draft.trim();
    if (!message) {
      toast.error("أدخل نص الإعلان قبل النشر");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message }),
      });
      const j = await res.json();
      if (!res.ok) {
        toast.error(String(j.message || "فشل النشر"));
        return;
      }
      setActive(j.active ?? null);
      setDraft(String(j.active?.message ?? ""));
      toast.success("تم نشر الإعلان لجميع اللاعبين والوكلاء");
    } catch {
      toast.error("فشل النشر");
    } finally {
      setSaving(false);
    }
  };

  const clearAll = async () => {
    setClearing(true);
    try {
      const res = await fetch("/api/admin/broadcast", { method: "DELETE", credentials: "include" });
      const j = await res.json();
      if (!res.ok) {
        toast.error(String(j.message || "فشل الإلغاء"));
        return;
      }
      setActive(null);
      setDraft("");
      toast.success("تم إيقاف البث العام");
    } catch {
      toast.error("فشل الإلغاء");
    } finally {
      setClearing(false);
    }
  };

  if (loading) {
    return (
      <SidebarShell role="admin">
        <LoadingCard text="جاري تحميل البث العام…" />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="البث العام"
        subtitle="رسالة واحدة نشطة تظهر أعلى واجهة اللاعب والوكيل (شريط إعلان عام). نشر رسالة جديدة يستبدل السابقة."
        action={
          <div className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-sky-200 md:flex">
            <Megaphone className="h-5 w-5" strokeWidth={1.5} />
          </div>
        }
      />

      <GlassCard className="mt-6 max-w-2xl space-y-5 p-6">
        {active ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs text-white/55">
            <span className="font-semibold text-emerald-300/90">نشط الآن</span>
            <span className="mx-2 text-white/25">·</span>
            {new Date(active.createdAt).toLocaleString()}
          </div>
        ) : (
          <p className="text-sm text-white/50">لا يوجد إعلان نشط حالياً.</p>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-white/60">نص الإعلان</label>
          <TextArea
            rows={6}
            dir="auto"
            placeholder="مثال: صيانة يوم الأحد من 02:00 إلى 04:00…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p className="mt-1 text-xs text-white/40">يُنصح بجمل واضحة ومختصرة. الحد الأقصى 8000 حرف.</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <PrimaryButton type="button" onClick={() => void publish()} disabled={saving || clearing}>
            {saving ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري النشر…
              </span>
            ) : (
              "نشر / تحديث الإعلان"
            )}
          </PrimaryButton>
          <button
            type="button"
            onClick={() => void clearAll()}
            disabled={saving || clearing || !active}
            className="inline-flex items-center gap-2 rounded-2xl border border-red-400/35 bg-red-500/10 px-5 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" strokeWidth={1.75} />}
            إيقاف البث وإخفاء الشريط
          </button>
        </div>
      </GlassCard>
    </SidebarShell>
  );
}
