"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Globe2, ShieldCheck, TimerReset, WalletCards } from "lucide-react";
import { GlassCard, PrimaryButton, Shell } from "@/components/ui";
// 🟢 المسمار الأول: عيطنا على الترجمة
import { useTranslation } from "@/lib/i18n";

type Banner = { title: string; subtitle: string; image: string; link: string; active: boolean };
type Branding = {
  brandName: string;
  logoUrl: string;
  heroTitle: string;
  heroBody: string;
  primaryCta: string;
  secondaryCta: string;
  heroImages: string[];
  banners: Banner[];
};

export default function HomePage() {
  const { t } = useTranslation(); // 🟢 المسمار الثاني: جبدنا دالة t
  const [branding, setBranding] = useState<Branding | null>(null);
  const [bannerIndex, setBannerIndex] = useState(0);

  // مصفوفات مترجمة (درناهم لداخل باش يتبدلو مع اللغة)
  const trustCards = [
    { value: "24/7", label: t("notifications") }, // استعملنا Keys موجودة
    { value: "3", label: "Player • Agent • Admin" },
    { value: "100%", label: t("antiFraud") },
  ];

  const flow = [
    { step: "01", title: t("createPlayer"), text: t("heroBody") }, 
    { step: "02", title: t("chooseAgent"), text: t("selectAgent") },
    { step: "03", title: t("uploadProof"), text: t("proofHint") },
  ];

  useEffect(() => {
    const loadBranding = async () => {
      try {
        const res = await fetch("/api/admin/branding", { cache: "no-store" });
        const data = await res.json();
        if (data.branding) setBranding(data.branding);
      } catch (error) {
        console.error("Branding load failed");
      }
    };
    void loadBranding();
  }, []);

  // ... (نفس الـ Logic ديال البنرات) ...

  return (
    <Shell>
      <div className="mx-auto max-w-7xl space-y-8">
        <GlassCard className="overflow-hidden px-5 py-7 md:px-8 md:py-9 xl:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div>
              <h1 className="max-w-2xl text-3xl font-semibold leading-tight tracking-tight text-white md:text-5xl xl:text-6xl">
                {/* 🟢 نترجمو العنوان: إلا كان الآدمين حط عنوان فـ الداتابيز نخدمو بيه، وإلا نترجمو الافتراضي */}
                {branding?.heroTitle || t("heroTitle")}
              </h1>

              <p className="mt-4 max-w-xl text-sm leading-7 text-white/65 md:text-base">
                {branding?.heroBody || t("heroBody")}
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/register/player">
                  <PrimaryButton className="min-w-[180px] px-6 py-3 text-sm font-semibold">
                    {t("createPlayer")}
                  </PrimaryButton>
                </Link>

                <Link
                  href="/apply/agent"
                  className="inline-flex min-w-[180px] items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  {t("becomeAgent")}
                  <ArrowRight size={15} />
                </Link>

                <Link
                  href="/login"
                  className="inline-flex min-w-[140px] items-center justify-center rounded-2xl border border-white/10 bg-black/20 px-5 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/10 hover:text-white"
                >
                  {t("login")}
                </Link>
              </div>

              {/* ... باقي العناصر مع استعمال t() ... */}
              <div className="mt-8 grid gap-3 sm:grid-cols-3">
                {trustCards.map((item) => (
                  <div key={item.label} className="rounded-3xl border border-white/10 bg-black/20 p-4 md:p-5">
                    <p className="text-2xl font-semibold md:text-3xl">{item.value}</p>
                    <p className="mt-2 text-xs leading-5 text-white/55 md:text-sm">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </GlassCard>

        {/* 🟢 ترجمة الـ Flow */}
        <div className="grid gap-4 md:grid-cols-3">
          {flow.map((item) => (
            <GlassCard key={item.step} className="p-5 md:p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">{item.step}</p>
              <h3 className="mt-3 text-xl font-semibold md:text-2xl">{item.title}</h3>
              <p className="mt-3 text-sm leading-6 text-white/60">{item.text}</p>
            </GlassCard>
          ))}
        </div>
      </div>
    </Shell>
  );
}