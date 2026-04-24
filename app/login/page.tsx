"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { GlassCard, PrimaryButton, Shell, TextField } from "@/components/ui";
import { useLanguage } from "@/components/language";

type LoginJson = {
  success?: boolean;
  message?: string;
  redirectAfterLogin?: string;
  user?: {
    role?: string;
    status?: string;
    applicationStatus?: string;
    player?: { assignedAgentId?: string | null };
  };
  role?: string;
};

export default function LoginPage() {
  const { t } = useLanguage();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!identifier.trim() || !password.trim()) {
      toast.error("أدخل اسم المستخدم أو البريد وكلمة المرور");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = (await res.json().catch(() => ({}))) as LoginJson;

      if (!res.ok || !data.success || !data.user) {
        throw new Error(data.message || "فشل تسجيل الدخول");
      }

      localStorage.setItem("mobcash_user", JSON.stringify(data.user));
      toast.success("تم تسجيل الدخول بنجاح!");

      /** Hard navigation so `Set-Cookie` on the login response is visible to the next document + middleware. */
      const redirect =
        typeof data.redirectAfterLogin === "string" && data.redirectAfterLogin.trim()
          ? data.redirectAfterLogin.trim()
          : null;
      if (redirect) {
        window.location.href = redirect;
        return;
      }

      const app = String(data.user.applicationStatus ?? "").trim().toUpperCase();
      if (app === "PENDING") {
        window.location.href = "/pending";
        return;
      }

      const roleRaw = data.user.role ?? data.role;
      const role = String(roleRaw ?? "").trim().toLowerCase();

      if (role === "agent") {
        window.location.href = "/agent/dashboard";
        return;
      }
      if (role === "player") {
        const acct = String(data.user.status ?? "").trim().toUpperCase();
        if (acct === "PENDING_AGENT") {
          window.location.href = "/player/choose-agent";
          return;
        }
        if (acct === "PENDING_APPROVAL") {
          window.location.href = "/player/dashboard";
          return;
        }
        const assigned = data.user.player?.assignedAgentId;
        window.location.href = assigned ? "/player/dashboard" : "/player/choose-agent";
        return;
      }
      if (role === "admin" || role === "super_admin") {
        window.location.href = "/admin/dashboard";
        return;
      }

      window.location.href = "/";
    } catch (e: unknown) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : "خطأ في الشبكة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Shell>
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="grid gap-6">
          <GlassCard className="p-6 md:p-8">
            <h1 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">{t("login")}</h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/60 md:text-base">{t("heroBody")}</p>
            <div className="mt-8 space-y-4">
              <TextField placeholder="Username or email" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              <TextField type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <PrimaryButton onClick={handleLogin} disabled={loading} className="w-full">{loading ? t("processing") : t("login")}</PrimaryButton>
            </div>
            <div className="mt-5 flex flex-wrap gap-3 text-sm text-white/60">
              <Link href="/register/player" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10">{t("createPlayer")}</Link>
              <Link href="/register/agent" className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10">{t("becomeAgent")}</Link>
            </div>
          </GlassCard>
         
        </div>
      </div>
    </Shell>
  );
}
