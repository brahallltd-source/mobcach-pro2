"use client";

import { useRouter } from "next/navigation";
import { Building2, Shield, Sparkles, Zap } from "lucide-react";
import { AgentProfileCard, type AgentProfileCardAgent } from "@/components/AgentProfileCard";
import { Shell } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { BRANDING } from "@/lib/branding";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/animations";

const TRUST_LABELS = [
  "CIH Bank",
  "Cash Plus",
  "USDT",
  "Wafacash",
  "Jibi",
  "Orange Money",
  "Attijariwafa bank",
  "CFG Bank",
];

type HomeLandingProps = {
  agents: AgentProfileCardAgent[];
};

export function HomeLanding({ agents }: HomeLandingProps) {
  const router = useRouter();
  const marqueeItems = [...TRUST_LABELS, ...TRUST_LABELS];

  return (
    <Shell>
      <div dir="rtl" className="mx-auto max-w-7xl space-y-12 pb-16 md:space-y-16 md:pb-24">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-[32px] border border-white/[0.08] bg-white/[0.02] p-6 shadow-2xl backdrop-blur-xl md:p-10 lg:p-14">
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-[10%] top-[-30%] h-[min(55vh,420px)] w-[min(70vw,520px)] rounded-full bg-cyan-500/20 blur-[120px]" />
            <div className="absolute -right-[5%] bottom-[-40%] h-[min(50vh,380px)] w-[min(65vw,480px)] rounded-full bg-violet-600/15 blur-[120px]" />
            <div className="absolute left-1/2 top-1/2 h-[min(40vh,320px)] w-[min(80vw,640px)] max-w-3xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
          </div>

          <div className="relative z-10 grid gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-14">
            <div>
              <FadeIn delay={0.05}>
                <p className="inline-flex items-center gap-2 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-4 py-1.5 text-xs font-semibold text-cyan-200">
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  منصة شحن آمنة وسريعة
                </p>
              </FadeIn>
              <FadeIn delay={0.1} className="mt-6 block">
                <h1 className="text-5xl font-bold leading-[1.08] tracking-tight text-white md:text-6xl">
                  {BRANDING.slogan}
                </h1>
              </FadeIn>
              <FadeIn delay={0.2} className="mt-5 block">
                <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                  اربط حسابك بوكيل معتمد، تابع طلباتك لحظة بلحظة، وتلقَّ دعماً مباشراً — بتجربة واجهة عصرية مصممة
                  للاعبين والوكلاء في المغرب وخارجه.
                </p>
              </FadeIn>
              <FadeIn delay={0.3} className="mt-8 block">
                <div className="flex flex-wrap items-center gap-4">
                  <Button size="lg" type="button" onClick={() => router.push("/register")}>
                    افتح حسابك الآن
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="border-white/20 bg-white/[0.04] text-white shadow-none backdrop-blur-md hover:bg-white/[0.08]"
                    onClick={() => document.getElementById("agents")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                  >
                    تصفح الوكلاء
                  </Button>
                </div>
              </FadeIn>
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-white/45">
                <span className="inline-flex items-center gap-2">
                  <Shield className="h-4 w-4 text-emerald-400/90" aria-hidden />
                  تحقق من الوكيل قبل الربط
                </span>
                <span className="inline-flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-300/90" aria-hidden />
                  تنفيذ سريع للطلبات
                </span>
              </div>
            </div>

            <div className="relative hidden min-h-[260px] flex-col justify-between rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.06] to-transparent p-8 lg:flex">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(circle_at_30%_20%,rgba(34,211,238,0.12),transparent_45%)]" />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/40">رصيد تجريبي</p>
                  <p className="mt-2 text-4xl font-black tabular-nums text-white">12,450</p>
                  <p className="text-sm text-white/45">درهم — جاهز للسحب</p>
                </div>
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-emerald-200">
                  <Building2 className="h-8 w-8" aria-hidden />
                </div>
              </div>
              <div className="relative mt-8 space-y-3 rounded-xl border border-white/10 bg-black/25 p-4">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>آخر عملية</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 font-medium text-emerald-200">مكتمل</span>
                </div>
                <p className="text-sm font-medium text-white">شحن عبر CIH Bank</p>
                <p className="text-xs text-white/40">منذ دقيقتين</p>
              </div>
            </div>
          </div>
        </section>

        {/* Trust marquee */}
        <section
          className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-black/25 py-5"
          aria-label="شركاء الدفع"
        >
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-24 bg-gradient-to-l from-[#0B0F19] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-24 bg-gradient-to-r from-[#0B0F19] to-transparent" />
          <div className="home-trust-marquee-track px-4">
            {marqueeItems.map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium text-white/25 md:text-base"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-white/20" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </section>

        {/* Live agents */}
        <section id="agents" className="scroll-mt-28">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between md:gap-6">
            <div>
              <h2 className="text-2xl font-bold text-white md:text-3xl">وكلاء متصلون الآن</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                نماذج حية من شبكة الوكلاء النشطين — اختر من يناسبك بعد إنشاء الحساب.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="self-start text-cyan-300 hover:bg-white/10 hover:text-cyan-200"
              onClick={() => router.push("/register")}
            >
              ابدأ التسجيل ←
            </Button>
          </div>

          <StaggerContainer className="mt-10 grid gap-8 md:grid-cols-2 lg:grid-cols-3 lg:gap-10">
            {agents.map((agent) => (
              <StaggerItem key={agent.id ?? agent.username} className="origin-top scale-[0.94] md:scale-[0.9]">
                <AgentProfileCard
                  agent={agent}
                  actionType="join"
                  headerLabel="وكيل متصل"
                  onAction={() => router.push("/register")}
                />
              </StaggerItem>
            ))}
          </StaggerContainer>
        </section>

        {/* Bottom CTA strip */}
        <section className="rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-8 text-center shadow-2xl backdrop-blur-xl md:p-10">
          <h3 className="text-xl font-bold text-white md:text-2xl">جاهز للانطلاق؟</h3>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground md:text-base">
            أنشئ حساب لاعب في دقائق، ثم اربط وكيلك وابدأ الشحن بأمان.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" type="button" onClick={() => router.push("/register")}>
              افتح حسابك الآن
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/login")}>
              تسجيل الدخول
            </Button>
          </div>
        </section>
      </div>
    </Shell>
  );
}
