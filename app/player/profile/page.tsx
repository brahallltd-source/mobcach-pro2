"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { toast } from "sonner";
import { ExternalLink, Mail, MessageCircle } from "lucide-react";
import { AgentStatusCard } from "@/components/AgentStatusCard";
import { SupportModal } from "@/components/SupportModal";
import { DeviceSettingsCard } from "@/components/pwa/DeviceSettingsCard";
import {
  DangerButton,
  GlassCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextField,
} from "@/components/ui";
import { useTranslation } from "@/lib/i18n";
import { usePlayerTx } from "@/hooks/usePlayerTx";
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

type ProfileFormValues = z.infer<ReturnType<typeof buildProfileSchema>>;
function buildProfileSchema(tp: (path: string) => string) {
  return z
    .object({
      email: z.string().email(tp("profile.validation.emailInvalid")),
      phone: z.string().min(6, tp("profile.validation.phoneShort")).max(32, tp("profile.validation.phoneLong")),
      newPassword: z.string().optional(),
      newPasswordConfirm: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      const p = (data.newPassword || "").trim();
      const c = (data.newPasswordConfirm || "").trim();
      if (!p && !c) return;
      if (p.length > 0 && p.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tp("profile.validation.passwordMin"),
          path: ["newPassword"],
        });
      }
      if (p !== c) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: tp("profile.validation.passwordMismatch"),
          path: ["newPasswordConfirm"],
        });
      }
    });
}

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

function siteLabel(raw: string, websiteFallback: string): string {
  const href = externalHref(raw);
  if (!href) return websiteFallback;
  try {
    return new URL(href).hostname.replace(/^www\./, "");
  } catch {
    return websiteFallback;
  }
}

export default function PlayerProfilePage() {
  const { t } = useTranslation();
  const tp = usePlayerTx();
  const profileSchema = useMemo(() => buildProfileSchema(tp), [tp]);
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
            ? tp("profile.sessionExpired")
            : tp("profile.loadFailed")
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
      if (p.pendingAgentRequest) setAgentStatus("pending");
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
        toast.error(data.message || tp("profile.updateFailed"));
        return;
      }
      toast.success(data.message || tp("profile.updateSuccess"));
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
      toast.error(tp("profile.networkError"));
    }
  });

  const onBecomeAgent = async () => {
    setAgentBusy(true);
    try {
      const res = await fetch("/api/agent-requests", { method: "POST", credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { message?: string; status?: string };
      if (!res.ok) {
        toast.error(data.message || tp("profile.becomeAgentFailed"));
        return;
      }
      setAgentStatus(data.status || "pending");
      toast.success(data.message || tp("profile.becomeAgentSuccess"));
      await loadProfile();
    } catch {
      toast.error(tp("profile.networkError"));
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
          <p className="text-white/70">{tp("profile.loading")}</p>
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
          <p className="text-white/65">{tp("profile.notFound")}</p>
        </GlassCard>
      </SidebarShell>
    );
  }

  const showAgentPending = Boolean(profile.pendingAgentRequest || agentStatus);

  return (
    <SidebarShell role="player">
      <PageHeader
        title={t("myProfile")}
        subtitle={tp("profile.subtitle")}
      />

      <div className="mx-auto mt-8 flex max-w-5xl flex-col gap-8">
        <AgentStatusCard />
        <div className="grid gap-8 lg:grid-cols-[1fr_1.05fr]">
          <GlassCard className="p-6 md:p-8">
            <h2 className="text-xl font-semibold text-white">{tp("profile.basicInfo")}</h2>
            <div className="mt-6 grid gap-4 text-sm text-white/75">
              <p>
                <span className="text-white/45">{tp("profile.labelFullName")}</span> {profile.first_name}{" "}
                {profile.last_name}
              </p>
              <p>
                <span className="text-white/45">{tp("profile.labelUsername")}</span> {profile.username}
              </p>
              <p>
                <span className="text-white/45">{tp("profile.labelDob")}</span> {profile.date_of_birth}
              </p>
              <p>
                <span className="text-white/45">{tp("profile.labelCity")}</span> {profile.city}
              </p>
              <p>
                <span className="text-white/45">{tp("profile.labelCountry")}</span> {profile.country}
              </p>
              <p>
                <span className="text-white/45">{tp("profile.labelStatus")}</span> {profile.status}
              </p>
              <p>
                <span className="text-white/45">{tp("profile.labelAgent")}</span>{" "}
                {profile.assigned_agent_id || tp("common.emDash")}
              </p>
            </div>
          </GlassCard>

          <GlassCard className="border-primary/25 bg-white/[0.04] p-6 shadow-xl backdrop-blur-md">
            <h2 className="text-xl font-semibold text-white">{tp("profile.editSectionTitle")}</h2>
            <form className="mt-5 space-y-4" onSubmit={onSaveProfile}>
              <div>
                <TextField type="email" placeholder={tp("profile.placeholderEmail")} {...profileForm.register("email")} />
                {profileForm.formState.errors.email ? (
                  <p className="mt-1 text-xs text-rose-300">{profileForm.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div>
                <TextField placeholder={tp("profile.placeholderPhone")} {...profileForm.register("phone")} />
                {profileForm.formState.errors.phone ? (
                  <p className="mt-1 text-xs text-rose-300">{profileForm.formState.errors.phone.message}</p>
                ) : null}
              </div>
              <div>
                <TextField
                  type="password"
                  placeholder={tp("profile.placeholderNewPassword")}
                  autoComplete="new-password"
                  {...profileForm.register("newPassword")}
                />
                {profileForm.formState.errors.newPassword ? (
                  <p className="mt-1 text-xs text-rose-300">{profileForm.formState.errors.newPassword.message}</p>
                ) : null}
              </div>
              <div>
                <TextField
                  type="password"
                  placeholder={tp("profile.placeholderConfirmPassword")}
                  autoComplete="new-password"
                  {...profileForm.register("newPasswordConfirm")}
                />
                {profileForm.formState.errors.newPasswordConfirm ? (
                  <p className="mt-1 text-xs text-rose-300">{profileForm.formState.errors.newPasswordConfirm.message}</p>
                ) : null}
              </div>
              <PrimaryButton type="submit" className="w-full" disabled={profileForm.formState.isSubmitting}>
                {profileForm.formState.isSubmitting ? tp("profile.saving") : tp("profile.saveChanges")}
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
                {showAgentPending ? tp("profile.pendingReview") : agentBusy ? tp("profile.sending") : tp("profile.becomeAgentCta")}
              </PrimaryButton>
              <Link href="/player/select-agent" className="block">
                <PrimaryButton type="button" className="w-full bg-cyan-200 text-slate-950 hover:bg-cyan-100">
                  {t("changeAgent")}
                </PrimaryButton>
              </Link>
              <DangerButton type="button" onClick={logout} className="w-full">
                {tp("profile.logout")}
              </DangerButton>
            </div>
          </GlassCard>
        </div>

        <DeviceSettingsCard />

        {branding ? (
          <GlassCard className="border-primary/25 p-6 md:p-8">
            <h2 className="text-lg font-semibold text-white">{tp("profile.contactTitle")}</h2>
            <p className="mt-1 text-sm text-white/50">{tp("profile.contactSubtitle")}</p>
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
                  {siteLabel(branding.websiteUrl, tp("common.website"))}
                </a>
              ) : null}
              {mailHref(branding.gmail) ? (
                <a
                  href={mailHref(branding.gmail)!}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm font-medium text-white/90 transition hover:border-cyan-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/45"
                >
                  <Mail className="h-4 w-4" />
                  {tp("common.gmail")}
                </a>
              ) : null}
            </div>
          </GlassCard>
        ) : null}
      </div>

    </SidebarShell>
  );
}
