"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
  GlassCard,
  LoadingCard,
  NavPill,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextField,
} from "@/components/ui";
import { DeviceSettingsCard } from "@/components/pwa/DeviceSettingsCard";
import { redirectToLogin, requireMobcashUserOnClient } from "@/lib/client-session";
import { agentProfileUpdateSchema, type AgentProfileUpdateInput } from "@/lib/agent-profile-update";

export default function AgentGeneralSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");

  const form = useForm<AgentProfileUpdateInput>({
    resolver: zodResolver(agentProfileUpdateSchema),
    defaultValues: {
      fullName: "",
      email: "",
      phone: "",
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    },
    mode: "onSubmit",
  });

  const { register, handleSubmit, reset, formState } = form;

  const load = useCallback(async () => {
    const res = await fetch("/api/agent/profile", { credentials: "include", cache: "no-store" });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "load failed");
    }
    setUsername(String(data.username ?? ""));
    reset({
      fullName: String(data.fullName ?? ""),
      email: String(data.email ?? ""),
      phone: String(data.phone ?? ""),
      currentPassword: "",
      newPassword: "",
      confirmNewPassword: "",
    });
  }, [reset]);

  useEffect(() => {
    void (async () => {
      const u = await requireMobcashUserOnClient("agent");
      if (!u) return void redirectToLogin();
      try {
        await load();
      } catch {
        toast.error("تعذّر تحميل الملف الشخصي");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  const onSubmit = async (values: AgentProfileUpdateInput) => {
    const res = await fetch("/api/agent/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.message || "فشل الحفظ");
      return;
    }
    toast.success(data.message || "تم حفظ التعديلات");
    try {
      await load();
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <SidebarShell role="agent">
        <LoadingCard text="جاري تحميل بيانات الوكيل..." />
      </SidebarShell>
    );
  }

  return (
    <SidebarShell role="agent">
      <PageHeader
        title="بيانات الوكيل"
        subtitle="تعديل المعلومات الشخصية وبريد الدخول. وسائل الدفع للاعبين تُدار من صفحة إعدادات الدفع فقط."
        action={
          <div className="flex flex-wrap gap-2">
            <NavPill href="/agent/settings/payments" label="إعدادات الدفع" />
            <NavPill href="/agent/dashboard" label="الرئيسية" />
          </div>
        }
      />

      <div className="mx-auto max-w-xl space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <GlassCard className="border border-white/[0.06] p-6 md:p-8">
          <h2 className="text-lg font-semibold text-white">الملف الشخصي</h2>
          <p className="mt-1 text-sm text-white/50">البيانات المعروضة للاعبين والإدارة وفق سياسة المنصة.</p>

          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/55">اسم المستخدم</label>
              <TextField
                value={username}
                disabled
                readOnly
                className="cursor-not-allowed border-white/10 bg-white/[0.06] text-white/60"
                aria-readonly="true"
              />
              <p className="mt-2 text-xs leading-relaxed text-amber-200/90">
                لا يمكن تغيير اسم المستخدم بعد التسجيل
              </p>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-white/55">الاسم الكامل</label>
              <TextField autoComplete="name" {...register("fullName")} />
              {formState.errors.fullName ? (
                <p className="mt-1 text-sm text-rose-300">{formState.errors.fullName.message}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-white/55">البريد الإلكتروني</label>
              <TextField type="email" autoComplete="email" {...register("email")} />
              {formState.errors.email ? (
                <p className="mt-1 text-sm text-rose-300">{formState.errors.email.message}</p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-white/55">رقم الهاتف</label>
              <TextField type="tel" autoComplete="tel" {...register("phone")} />
              {formState.errors.phone ? (
                <p className="mt-1 text-sm text-rose-300">{formState.errors.phone.message}</p>
              ) : null}
            </div>
          </div>
        </GlassCard>

        <GlassCard className="border border-white/[0.06] p-6 md:p-8">
          <h2 className="text-lg font-semibold text-white">تغيير كلمة المرور</h2>
          <p className="mt-1 text-sm text-white/50">اترك الحقول فارغة إن لم ترغب بتغيير كلمة المرور.</p>
          <div className="mt-6 space-y-5">
            <div>
              <label className="mb-1 block text-xs font-medium text-white/55">كلمة المرور الحالية</label>
              <TextField type="password" autoComplete="current-password" {...register("currentPassword")} />
              {formState.errors.currentPassword ? (
                <p className="mt-1 text-sm text-rose-300">{formState.errors.currentPassword.message}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/55">كلمة المرور الجديدة</label>
              <TextField type="password" autoComplete="new-password" {...register("newPassword")} />
              {formState.errors.newPassword ? (
                <p className="mt-1 text-sm text-rose-300">{formState.errors.newPassword.message}</p>
              ) : null}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-white/55">تأكيد كلمة المرور الجديدة</label>
              <TextField type="password" autoComplete="new-password" {...register("confirmNewPassword")} />
              {formState.errors.confirmNewPassword ? (
                <p className="mt-1 text-sm text-rose-300">{formState.errors.confirmNewPassword.message}</p>
              ) : null}
            </div>
          </div>
        </GlassCard>

        <PrimaryButton type="submit" className="min-w-[200px]" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? "جاري الحفظ..." : "حفظ التعديلات"}
        </PrimaryButton>
      </form>
      <DeviceSettingsCard />
      </div>
    </SidebarShell>
  );
}
