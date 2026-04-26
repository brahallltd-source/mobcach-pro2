"use client";

import { useMemo, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import {
  BadgeCheck,
  ChevronLeft,
  Handshake,
  Landmark,
  Send,
  Shield,
  ShieldCheck,
  UserRound,
  UserSearch,
  Wallet,
} from "lucide-react";
import { AgentProfileCard, type AgentProfileCardAgent } from "@/components/AgentProfileCard";
import { FadeIn, StaggerContainer, StaggerItem } from "@/components/animations";
import { Shell } from "@/components/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { Footer } from "@/components/Footer";
import { useTranslation } from "@/lib/i18n";

const TRUST_MARQUEE = ["CIH", "Attijari", "Cash Plus", "Wafacash", "USDT"] as const;

type Gs365CashLandingProps = {
  agents: AgentProfileCardAgent[];
};

function RevealSection({
  children,
  className,
  id,
  "aria-label": ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  return (
    <motion.section
      id={id}
      className={className}
      aria-label={ariaLabel}
      initial={{ opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.section>
  );
}

function RoadmapConnectorVertical() {
  return (
    <div className="flex flex-col items-center py-3" aria-hidden>
      <div className="h-10 w-px bg-gradient-to-b from-cyan-500/45 via-white/12 to-transparent" />
      <ChevronLeft className="mt-1 h-5 w-5 rotate-[-90deg] text-cyan-400/55" />
    </div>
  );
}

function RoadmapConnectorHorizontal() {
  return (
    <div className="flex min-w-[1.25rem] flex-1 items-center px-0.5" aria-hidden>
      <div className="h-px flex-1 rounded-full bg-gradient-to-l from-cyan-500/35 via-white/12 to-transparent" />
      <ChevronLeft className="mx-0.5 h-5 w-5 shrink-0 text-cyan-400/65 rtl:rotate-180" />
      <div className="h-px flex-1 rounded-full bg-gradient-to-r from-cyan-500/35 via-white/12 to-transparent" />
    </div>
  );
}

function TransactionRoadmapSection() {
  const { tx } = useTranslation();
  const steps = useMemo(
    () =>
      [
        {
          Icon: UserSearch,
          label: tx("home.roadmap.step1Label"),
          hint: tx("home.roadmap.step1Hint"),
        },
        {
          Icon: Landmark,
          label: tx("home.roadmap.step2Label"),
          hint: tx("home.roadmap.step2Hint"),
        },
        {
          Icon: BadgeCheck,
          label: tx("home.roadmap.step3Label"),
          hint: tx("home.roadmap.step3Hint"),
        },
        {
          Icon: Send,
          label: tx("home.roadmap.step4Label"),
          hint: tx("home.roadmap.step4Hint"),
        },
      ] as const,
    [tx],
  );

  return (
    <RevealSection className="space-y-8">
      <div>
        <motion.h2
          className="text-2xl font-bold text-white md:text-3xl"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          {tx("home.roadmap.title")}
        </motion.h2>
        <motion.p
          className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          {tx("home.roadmap.subtitle")}
        </motion.p>
      </div>

      <div className="relative overflow-hidden rounded-[28px] border border-white/[0.08] bg-white/[0.03] p-6 shadow-glass backdrop-blur-xl md:p-10">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(34,211,238,0.08),transparent_55%)]"
          aria-hidden
        />
        <div className="relative mb-6 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/35">
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">{tx("home.roadmap.rolePlayer")}</span>
          <span className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" aria-hidden />
          <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 text-cyan-200/90">
            {tx("home.roadmap.roleAgent")}
          </span>
        </div>

        {/* Mobile: vertical stack */}
        <div className="relative flex flex-col items-center md:hidden">
          {steps.map((step, i) => {
            const Icon = step.Icon;
            return (
              <div key={step.label} className="flex w-full max-w-sm flex-col items-center">
                <motion.div
                  className="flex flex-col items-center text-center"
                  initial={{ opacity: 0, y: 14 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.25 }}
                  transition={{ duration: 0.4, delay: i * 0.06 }}
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 to-transparent text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
                    <Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden />
                  </div>
                  <p className="mt-3 text-sm font-bold text-white">{step.label}</p>
                  <p className="mt-1 text-[11px] text-white/40">{step.hint}</p>
                </motion.div>
                {i < steps.length - 1 ? <RoadmapConnectorVertical /> : null}
              </div>
            );
          })}
        </div>

        {/* Desktop: horizontal flowchart (order follows RTL/LTR from document dir) */}
        <div className="relative hidden w-full items-start md:flex">
          {steps.flatMap((step, i) => {
            const Icon = step.Icon;
            const block = (
              <motion.div
                key={`d-${step.label}`}
                className="flex min-w-0 flex-1 flex-col items-center text-center"
                initial={{ opacity: 0, y: 14 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/15 to-transparent text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.2)]">
                  <Icon className="h-8 w-8" strokeWidth={1.75} aria-hidden />
                </div>
                <p className="mt-3 text-sm font-bold text-white lg:text-base">{step.label}</p>
                <p className="mt-1 text-[11px] text-white/40">{step.hint}</p>
              </motion.div>
            );
            if (i >= steps.length - 1) return [block];
            return [
              block,
              <div
                key={`dh-${step.label}`}
                className="flex min-w-[1.5rem] max-w-[5rem] flex-1 items-center self-start pt-8"
              >
                <RoadmapConnectorHorizontal />
              </div>,
            ];
          })}
        </div>
      </div>
    </RevealSection>
  );
}

function MutualSecuritySection() {
  const { tx } = useTranslation();
  return (
    <RevealSection className="space-y-8">
      <div>
        <motion.h2
          className="text-2xl font-bold text-white md:text-3xl"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          {tx("home.security.title")}
        </motion.h2>
        <motion.p
          className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base"
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.05 }}
        >
          {tx("home.security.subtitle")}
        </motion.p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <motion.div
          className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-glass backdrop-blur-xl md:p-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
            <ShieldCheck className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="text-lg font-bold text-white">{tx("home.security.playerTitle")}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{tx("home.security.playerBody")}</p>
        </motion.div>
        <motion.div
          className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-glass backdrop-blur-xl md:p-8"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.45, delay: 0.06 }}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 text-cyan-200">
            <Shield className="h-6 w-6" aria-hidden />
          </div>
          <h3 className="text-lg font-bold text-white">{tx("home.security.agentTitle")}</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{tx("home.security.agentBody")}</p>
        </motion.div>
      </div>
    </RevealSection>
  );
}

function NeonIconWrap({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-400/35 bg-cyan-500/10 text-cyan-300 shadow-[0_0_28px_rgba(34,211,238,0.28)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function FloatingHeroAgentCard({
  agent,
  onCta,
}: {
  agent: AgentProfileCardAgent;
  onCta: () => void;
}) {
  const { tx } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);
  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const sx = useSpring(mx, { stiffness: 280, damping: 26, mass: 0.4 });
  const sy = useSpring(my, { stiffness: 280, damping: 26, mass: 0.4 });
  const rotateX = useTransform(sy, [-0.5, 0.5], [11, -11]);
  const rotateY = useTransform(sx, [-0.5, 0.5], [-11, 11]);

  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    mx.set((e.clientX - r.left) / r.width - 0.5);
    my.set((e.clientY - r.top) / r.height - 0.5);
  };
  const onLeave = () => {
    mx.set(0);
    my.set(0);
  };

  return (
    <div className="perspective-[1100px] lg:justify-self-end" style={{ perspective: 1100 }}>
      <motion.div
        ref={ref}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" as const }}
        className="relative w-full max-w-md will-change-transform"
      >
        <motion.div
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 4.2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformStyle: "preserve-3d" as const }}
        >
          <div
            className="rounded-2xl shadow-[0_28px_80px_rgba(0,0,0,0.45),0_0_60px_rgba(34,211,238,0.12)]"
            style={{ transform: "translateZ(24px)" }}
          >
            <AgentProfileCard
              agent={agent}
              actionType="join"
              headerLabel={tx("home.heroCard.headerLabel")}
              actionButtonLabel={tx("home.heroCard.ctaLabel")}
              onAction={onCta}
            />
          </div>
        </motion.div>
        <div
          className="pointer-events-none absolute -inset-8 -z-10 rounded-[40px] bg-gradient-to-br from-cyan-500/20 via-transparent to-violet-600/15 blur-2xl"
          aria-hidden
        />
      </motion.div>
    </div>
  );
}

export function Gs365CashLanding({ agents }: Gs365CashLandingProps) {
  const router = useRouter();
  const { tx, dir } = useTranslation();
  const heroFallback = useMemo(
    (): AgentProfileCardAgent => ({
      id: "hero-demo",
      name: tx("home.hero.demoAgentName"),
      username: tx("home.hero.demoUsername"),
      isOnline: true,
      rating: 97,
      paymentMethods: [
        { id: "h1", methodName: "CIH Bank" },
        { id: "h2", methodName: "USDT" },
      ],
    }),
    [tx],
  );
  const heroAgent = agents[0] ?? heroFallback;
  const spotlight = agents.slice(0, 3);
  const marqueeItems = [...TRUST_MARQUEE, ...TRUST_MARQUEE, ...TRUST_MARQUEE];

  const howSteps = useMemo(
    () =>
      [
        {
          icon: <UserRound className="h-7 w-7" aria-hidden />,
          title: tx("home.how.step1Title"),
          body: tx("home.how.step1Body"),
        },
        {
          icon: <Handshake className="h-7 w-7" aria-hidden />,
          title: tx("home.how.step2Title"),
          body: tx("home.how.step2Body"),
        },
        {
          icon: <Wallet className="h-7 w-7" aria-hidden />,
          title: tx("home.how.step3Title"),
          body: tx("home.how.step3Body"),
        },
      ] as const,
    [tx],
  );

  return (
    <Shell>
      <div dir={dir} className="mx-auto max-w-7xl space-y-14 pb-20 md:space-y-20 md:pb-28">
        {/* Hero */}
        <motion.section
          className="relative overflow-hidden rounded-[32px] border border-white/[0.09] bg-white/[0.03] p-6 shadow-glass backdrop-blur-2xl md:p-10 lg:p-14"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="pointer-events-none absolute inset-0 bg-hero opacity-90" aria-hidden />
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            <div className="absolute -left-[12%] top-[-28%] h-[min(52vh,400px)] w-[min(72vw,520px)] rounded-full bg-cyan-500/18 blur-[120px]" />
            <div className="absolute -right-[8%] bottom-[-35%] h-[min(48vh,360px)] w-[min(68vw,480px)] rounded-full bg-cyan-400/10 blur-[110px]" />
          </div>

          <div className="relative z-10 grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div>
              <FadeIn delay={0.05} className="block">
                <h1 className="text-4xl font-black leading-[1.06] tracking-tight text-white sm:text-5xl md:text-6xl">
                  {tx("home.hero.title")}
                </h1>
              </FadeIn>
              <FadeIn delay={0.14} className="mt-5 block">
                <p className="max-w-xl text-base leading-relaxed text-muted-foreground md:text-lg">
                  {tx("home.hero.description")}
                </p>
              </FadeIn>
              <FadeIn delay={0.22} className="mt-8 flex flex-wrap gap-4">
                <Button
                  size="lg"
                  type="button"
                  className="bg-cyan-500 text-[#0B0F19] shadow-[0_0_32px_rgba(34,211,238,0.35)] hover:bg-cyan-400"
                  onClick={() => router.push("/register")}
                >
                  {tx("home.hero.start_btn")}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="border-cyan-500/30 bg-white/[0.04] text-white shadow-none backdrop-blur-md hover:border-cyan-400/50 hover:bg-cyan-500/10"
                  onClick={() => document.getElementById("become-agent")?.scrollIntoView({ behavior: "smooth" })}
                >
                  {tx("home.hero.agent_btn")}
                </Button>
              </FadeIn>
            </div>

            <FadeIn delay={0.28} className="flex justify-center lg:block">
              <FloatingHeroAgentCard agent={heroAgent} onCta={() => router.push("/register")} />
            </FadeIn>
          </div>
        </motion.section>

        {/* Trust marquee */}
        <RevealSection
          className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-black/30 py-5 shadow-inner backdrop-blur-md"
          aria-label={tx("home.trustMarqueeAria")}
        >
          <motion.div
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#0B0F19] to-transparent md:w-28"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          />
          <motion.div
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#0B0F19] to-transparent md:w-28"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          />
          <div className="home-trust-marquee-track opacity-70">
            {marqueeItems.map((label, i) => (
              <span
                key={`${label}-${i}`}
                className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap text-sm font-medium text-white/30 md:text-base"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400/25" aria-hidden />
                {label}
              </span>
            ))}
          </div>
        </RevealSection>

        {/* How it works */}
        <RevealSection className="scroll-mt-24 space-y-8">
          <div>
            <motion.h2
              className="text-2xl font-bold text-white md:text-3xl"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
            >
              {tx("home.how.title")}
            </motion.h2>
            <motion.p
              className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base"
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.06 }}
            >
              {tx("home.how.subtitle")}
            </motion.p>
          </div>

          <StaggerContainer className="grid gap-6 md:grid-cols-3">
            {howSteps.map((step) => (
              <StaggerItem key={step.title}>
                <div className="flex h-full flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-6 shadow-glass backdrop-blur-xl transition hover:border-cyan-400/25 hover:shadow-[0_0_40px_rgba(34,211,238,0.08)]">
                  <NeonIconWrap>{step.icon}</NeonIconWrap>
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </RevealSection>

        <TransactionRoadmapSection />

        <MutualSecuritySection />

        {/* Become an agent — spotlight cards */}
        <RevealSection id="become-agent" className="scroll-mt-28 space-y-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white md:text-3xl">{tx("home.spotlight.title")}</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
                {tx("home.spotlight.subtitle")}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="self-start text-cyan-300 hover:bg-white/10 hover:text-cyan-200"
              onClick={() => router.push("/register/agent")}
            >
              {tx("home.spotlight.ctaLink")}
            </Button>
          </div>

          <StaggerContainer className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {spotlight.map((agent, idx) => (
              <StaggerItem key={agent.id ?? `${agent.username}-${idx}`} className="min-w-0">
                <motion.div
                  className="origin-top"
                  whileHover={{ scale: 1.02 }}
                  transition={{ type: "spring", stiffness: 400, damping: 22 }}
                >
                  <div className="scale-[0.88] sm:scale-[0.92]">
                    <AgentProfileCard
                      agent={{ ...agent, isOnline: true }}
                      actionType="join"
                      headerLabel={tx("home.spotlight.onlineLabel")}
                      actionButtonLabel={tx("home.spotlight.joinCta")}
                      onAction={() => router.push("/register/agent")}
                    />
                  </div>
                </motion.div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </RevealSection>

        {/* Agent recruitment */}
        <RevealSection>
          <motion.div
            className="relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#050812]/85 p-8 shadow-2xl backdrop-blur-2xl md:p-12"
            initial={{ opacity: 0, scale: 0.98 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, amount: 0.35 }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(34,211,238,0.12),transparent_50%),radial-gradient(ellipse_at_100%_100%,rgba(139,92,246,0.08),transparent_45%)]"
              aria-hidden
            />
            <div className="relative mx-auto max-w-2xl text-center">
              <h3 className="text-xl font-bold text-white md:text-2xl">{tx("home.recruit.title")}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">{tx("home.recruit.subtitle")}</p>
              <div className="mt-8">
                <Button
                  size="lg"
                  type="button"
                  className="bg-cyan-500 px-8 text-base font-bold text-[#0B0F19] shadow-[0_0_36px_rgba(34,211,238,0.4)] hover:bg-cyan-400"
                  onClick={() => router.push("/register/agent")}
                >
                  {tx("home.recruit.cta")}
                </Button>
              </div>
            </div>
          </motion.div>
        </RevealSection>

        <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }}>
          <Footer />
        </motion.div>
      </div>
    </Shell>
  );
}
