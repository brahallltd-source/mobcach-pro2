"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { ExternalLink, Mail, MessageCircle } from "lucide-react";
import { AgentStatusCard } from "@/components/AgentStatusCard";
import { SupportModal } from "@/components/SupportModal";
import {
  DangerButton,
  GlassCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextField,
} from "@/components/ui";
import { useLanguage } from "@/components/language";
import { fetchSessionUser, redirectToLogin } from "@/lib/client-session";
import type { MobcashUser } from "@/lib/mobcash-user-types";

type CurrentUser = { id: string; email: string; role: string };
type PlayerProfile = {
  user_id: string;
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
  username: string;
  city: string;
  country: string;
  date_of_birth: string;
  status: string;
  assigned_agent_id: string;
  pendingAgentRequest?: boolean;
};

type PublicBranding = {
  facebook: string | null;
  instagram: string | null;
  telegram: string | null;
  gmail: string | null;
  websiteUrl: string;
  showFb: boolean;
  showInsta: boolean;
  showTele: boolean;
};

const profileSchema = z
  .object({
    email: z.string().email("بريد غير صالح"),
    phone: z.string().min(6, "الهاتف قصير جداً").max(32, "الهاتف طويل جداً"),
    newPassword: z.string().optional(),
    newPasswordConfirm: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const p = (data.newPassword || "").trim();
    const c = (data.newPasswordConfirm || "").trim();
    if (!p && !c) return;
    if (p.length > 0 && p.length < 6) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "كلمة المرور 6 أحرف على الأقل", path: ["newPassword"] });
    }
    if (p !== c) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "تأكيد كلمة المرور غير متطابق", path: ["newPasswordConfirm"] });
    }
  });

type ProfileFormValues = z.infer<typeof profileSchema>;

const supportSchema = z.object({
  subject: z.string().min(1, { message: "يرجى اختيار موضوع المشكلة" }),
  message: z.string().min(10, { message: "الرسالة يجب أن تتكون من 10 أحرف على الأقل لشرح المشكلة" }),
});

type SupportFormValues = z.infer<typeof supportSchema>;

function externalHref(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://${s}`;
}

function mailHref(raw: string | null | undefined): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (s.includes("@")) return `mailto:${s}`;
  return `mailto:${s}`;
}

function siteLabel(raw: string): string {
  const href = externalHref(raw);
  if (!href) return "Website";
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return "Website";
  }
}

export default function PlayerProfilePage() {
  const { t } = useLanguage();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<PublicBranding | null>(null);
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentStatus, setAgentStatus] = useState<string | null>(null);

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { email: "", phone: "", newPassword: "", newPasswordConfirm: "" },
  });

  const supportForm = useForm<SupportFormValues>({
    resolver: zodResolver(supportSchema),
    defaultValues: { subject: "", message: "" },
  });

  const loadBranding = async () => {
    try {
      const res = await fetch("/api/branding", { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { branding?: PublicBranding };
      if (res.ok && data.branding) setBranding(data.branding);
    } catch {
      /* ignore */
    }
  };

  const loadProfile = async () => {
    setProfileError(null);
    const res = await fetch("/api/player/profile", {
      cache: "no-store",
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as { profile?: PlayerProfile; message?: string };
    if (!res.ok) {
      setProfile(null);
      setProfileError(
        typeof data.message === "string"
          ? data.message
          : res.status === 401
            ? "انتهت الجلسة. حدّث الصفحة."
            : "تعذّر تحميل الملف الشخصي."
      );
      return;
    }
    const p = data.profile ?? null;
    setProfile(p);
    if (p) {
      const ph = p.phone === "—" ? "" : p.phone;
      profileForm.reset({
        email: p.email,
        phone: ph,
        newPassword: "",
        newPasswordConfirm: "",
      });
      if (p.pendingAgentRequest) setAgentStatus("قيد المراجعة");
    }
  };

  useEffect(() => {
    void loadBranding();
  }, []);

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
      setCurrentUser({ id: mu.id, email: mu.email, role: mu.role });
      await loadProfile();
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap once
  }, []);

  const onSaveProfile = profileForm.handleSubmit(async (values) => {
    if (!currentUser) return;
    const pwd = values.newPassword?.trim();
    const body: Record<string, string> = {
      newEmail: values.email.trim(),
      newPhone: values.phone.trim(),
    };
    if (pwd && pwd.length >= 6) {
      body.newPassword = pwd;
    }
    try {
      const res = await fetch("/api/player/profile", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; user?: CurrentUser & Record<string, unknown> };
      if (!res.ok) {
        toast.error(data.message || "فشل التحديث");
        return;
      }
      toast.success(data.message || "تم التحديث");
      if (data.user) {
        try {
          localStorage.setItem("mobcash_user", JSON.stringify(data.user));
        } catch {
          /* ignore */
        }
        setCurrentUser({
          id: String(data.user.id),
          email: String(data.user.email),
          role: String(data.user.role ?? "player"),
        });
      }
      profileForm.setValue("newPassword", "");
      profileForm.setValue("newPasswordConfirm", "");
      await loadProfile();
    } catch {
      toast.error("خطأ في الشبكة");
    }
  });

  const onBecomeAgent = async () => {
    setAgentBusy(true);
    try {
      const res = await fetch("/api/agent-requests", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { message?: string; status?: string };
      if (!res.ok) {
        toast.error(data.message || "تعذّر إرسال الطلب");
        return;
      }
      setAgentStatus(data.status || "قيد المراجعة");
      toast.success(data.message || "تم استلام طلبك");
      await loadProfile();
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setAgentBusy(false);
    }
  };

  const logout = () => {
    fetch("/api/logout", { method: "POST", credentials: "include" }).finally(() => {
      localStorage.removeItem("mobcash_user");
      window.location.href = "/login";
    });
  };

  if (loading) {
    return (
      <SidebarShell role="player">
        <GlassCard className="border-primary/25 bg-white/[0.04] p-12 text-center shadow-xl backdrop-blur-md">
          <p className="text-white/70">جاري تحميل الملف الشخصي…</p>
        </GlassCard>
      </SidebarShell>
    );
  }
  if (profileError) {
    return (
      <SidebarShell role="player">
        <GlassCard className="border-rose-400/25 bg-white/[0.04] p-12 text-center shadow-xl backdrop-blur-md">
          <p className="text-rose-200">{profileError}</p>
        </GlassCard>
      </SidebarShell>
    );
  }
  if (!profile) {
    return (
      <SidebarShell role="player">
        <GlassCard className="border-primary/25 bg-white/[0.04] p-12 text-center shadow-xl backdrop-blur-md">
          <p className="text-white/65">لم يتم العثور على الملف الشخصي.</p>
        </GlassCard>
      </SidebarShell>
    );
  }

  const showAgentPending = Boolean(profile.pendingAgentRequest || agentStatus);

  return (
    <SidebarShell role="player">
      <PageHeader
        title={t("myProfile")}
        subtitle="تحديث البريد والهاتف وكلمة المرور، الدعم الفني، وطلب الانضمام كوكيل."
      />

      <div className="mx-auto mt-8 flex max-w-5xl flex-col gap-8">
        <AgentStatusCard />
        <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
          <GlassCard className="p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white">المعلومات الأساسية</h2>
            <div className="mt-6 grid gap-4 text-sm text-white/75">
              <p>
                <span className="text-white/45">الاسم:</span> {profile.first_name} {profile.last_name}
              </p>
              <p>
                <span className="text-white/45">اسم المستخدم:</span> {profile.username}
              </p>
              <p>
                <span className="text-white/45">تاريخ الميلاد:</span> {profile.date_of_birth}
              </p>
              <p>
                <span className="text-white/45">المدينة:</span> {profile.city}
              </p>
              <p>
                <span className="text-white/45">البلد:</span> {profile.country}
              </p>
              <p>
                <span className="text-white/45">الحالة:</span> {profile.status}
              </p>
              <p>
                <span className="text-white/45">الوكيل:</span> {profile.assigned_agent_id || "—"}
              </p>
            </div>
          </GlassCard>

          <GlassCard className="border-primary/25 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md">
            <h2 className="text-xl font-semibold text-white">تعديل البريد والهاتف وكلمة المرور</h2>
            <form className="mt-5 space-y-4" onSubmit={onSaveProfile}>
              <div>
                <TextField type="email" placeholder="البريد" {...profileForm.register("email")} />
                {profileForm.formState.errors.email ? (
                  <p className="mt-1 text-xs text-rose-300">{profileForm.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div>
                <TextField placeholder="الهاتف" {...profileForm.register("phone")} />
                {profileForm.formState.errors.phone ? (
                  <p className="mt-1 text-xs text-rose-300">{profileForm.formState.errors.phone.message}</p>
                ) : null}
              </div>
              <div>
                <TextField type="password" placeholder="كلمة مرور جديدة (اختياري)" autoComplete="new-password" {...profileForm.register("newPassword")} />
                {profileForm.formState.errors.newPassword ? (
                  <p className="mt-1 text-xs text-rose-300">{profileForm.formState.errors.newPassword.message}</p>
                ) : null}
              </div>
              <div>
                <TextField type="password" placeholder="تأكيد كلمة المرور" autoComplete="new-password" {...profileForm.register("newPasswordConfirm")} />
                {profileForm.formState.errors.newPasswordConfirm ? (
                  <p className="mt-1 text-xs text-rose-300">{profileForm.formState.errors.newPasswordConfirm.message}</p>
                ) : null}
              </div>
              <PrimaryButton type="submit" className="w-full" disabled={profileForm.formState.isSubmitting}>
                {profileForm.formState.isSubmitting ? "جاري الحفظ…" : "حفظ التغييرات"}
              </PrimaryButton>
            </form>

            <div className="mt-8 flex flex-col gap-5 border-t border-white/10 pt-8">
              <SupportModal />
              <PrimaryButton
                type="button"
                className="w-full bg-amber-500/20 text-amber-100 ring-1 ring-amber-400/30 hover:bg-amber-500/30"
                disabled={agentBusy || showAgentPending}
                onClick={() => void onBecomeAgent()}
              >
                {showAgentPending ? "قيد المراجعة" : agentBusy ? "جاري الإرسال…" : "كن وكيلاً معنا"}
              </PrimaryButton>
              <Link href="/player/select-agent" className="block">
                <PrimaryButton type="button" className="w-full bg-cyan-200 text-slate-950 hover:bg-cyan-100">
                  {t("changeAgent")}
                </PrimaryButton>
              </Link>
              <DangerButton type="button" onClick={logout} className="w-full">
                تسجيل الخروج
              </DangerButton>
            </div>
          </GlassCard>
        </div>

        {branding ? (
          <GlassCard className="border-primary/25 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-white">تواصل معنا</h2>
            <p className="mt-1 text-sm text-white/50">روابط رسمية وتحديثات المنصة.</p>
            <div className="mt-6 flex flex-wrap items-center gap-4 md:gap-6">
              {branding.showFb && externalHref(branding.facebook) ? (
                <a
                  href={externalHref(branding.facebook)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-white/90 hover:border-cyan-400/40 hover:bg-cyan-500/10"
                  aria-label="Facebook"
                >
                  f
                </a>
              ) : null}
              {branding.showInsta && externalHref(branding.instagram) ? (
                <a
                  href={externalHref(branding.instagram)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-sm font-bold text-white/90 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45"
                  aria-label="Instagram"
                >
                  in
                </a>
              ) : null}
              {branding.showTele && externalHref(branding.telegram) ? (
                <a
                  href={externalHref(branding.telegram)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white/90 transition hover:border-cyan-400/40 hover:bg-cyan-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45"
                  aria-label="Telegram"
                >
                  <MessageCircle className="h-5 w-5" />
                </a>
              ) : null}
              {externalHref(branding.websiteUrl) ? (
                <a
                  href={externalHref(branding.websiteUrl)!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45"
                >
                  <ExternalLink className="h-4 w-4" />
                  {siteLabel(branding.websiteUrl)}
                </a>
              ) : null}
              {mailHref(branding.gmail) ? (
                <a
                  href={mailHref(branding.gmail)!}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition hover:border-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45"
                >
                  <Mail className="h-4 w-4" />
                  Gmail
                </a>
              ) : null}
            </div>
          </GlassCard>
        ) : null}
      </div>

    </SidebarShell>
  );
}
