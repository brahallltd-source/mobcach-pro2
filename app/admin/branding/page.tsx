"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  GlassCard,
  PageHeader,
  PrimaryButton,
  SidebarShell,
  TextArea,
  TextField,
} from "@/components/ui";

type Banner = {
  title: string;
  subtitle: string;
  image: string;
  link: string;
  active: boolean;
};

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

const defaultBranding: Branding = {
  brandName: "GS365Cash",
  logoUrl: "",
  heroTitle: "Recharge made simple, trusted and mobile-first.",
  heroBody:
    "GS365Cash connects players, agents and admins with a clear recharge flow, trusted agent selection and proof-based order confirmation.",
  primaryCta: "Start Recharge",
  secondaryCta: "Become an Agent",
  heroImages: ["/hero/hero-1.svg", "/hero/hero-2.svg"],
  banners: [
    {
      title: "Fast recharge flow",
      subtitle: "Choose your agent and upload your proof in a clear guided flow.",
      image: "/hero/hero-1.svg",
      link: "/register/player",
      active: true,
    },
    {
      title: "Join as an agent",
      subtitle: "Operate your wallet, payment methods and orders from one workspace.",
      image: "/hero/hero-2.svg",
      link: "/apply/agent",
      active: true,
    },
  ],
};

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
];

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export default function AdminBrandingPage() {
  const [branding, setBranding] = useState<Branding>(defaultBranding);
  const [saving, setSaving] = useState(false);

  // Refs للتحكم في أزرار الرفع
  const heroInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const bannerInputRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)];
  const logoInputRef = useRef<HTMLInputElement>(null);

  // 1. إصلاح جلب البيانات: تحديث الـ State عند التحميل
  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/admin/branding", { cache: "no-store" });
        const data = await res.json();
        if (data.branding) {
          const mergedData = { ...defaultBranding, ...data.branding };
          setBranding(mergedData);
          localStorage.setItem("mobcash_branding", JSON.stringify(mergedData));
        }
      } catch (err) {
        console.error("Failed to load branding", err);
      }
    };
    void load();
  }, []);

  // 2. دالة الحفظ
  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ branding }), // التأكد من إرسال الكائن بشكل صحيح
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");

      alert("تم حفظ البيانات بنجاح!");
      localStorage.setItem("mobcash_branding", JSON.stringify(branding));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const readImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return null;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert("يرجى رفع صور من نوع PNG, JPG, SVG أو WEBP فقط.");
      return null;
    }
    return await fileToDataUrl(file);
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const img = await readImage(e);
    if (img) setBranding(prev => ({ ...prev, logoUrl: img }));
    e.target.value = "";
  };

  const handleHeroUpload = async (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const img = await readImage(e);
    if (img) {
      setBranding(prev => {
        const images = [...prev.heroImages];
        images[index] = img;
        return { ...prev, heroImages: images };
      });
    }
    e.target.value = "";
  };

  const handleBannerUpload = async (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const img = await readImage(e);
    if (img) {
      setBranding(prev => {
        const next = [...prev.banners];
        next[index] = { ...next[index], image: img };
        return { ...prev, banners: next };
      });
    }
    e.target.value = "";
  };

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Branding panel"
        subtitle="إدارة الهوية البصرية، الشعار، وصور البانرات المتحركة."
        action={
          <PrimaryButton onClick={save} disabled={saving}>
            {saving ? "جاري الحفظ..." : "Save branding"}
          </PrimaryButton>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <div className="space-y-6">
          <GlassCard className="p-6 md:p-8 space-y-4">
            <h3 className="text-lg font-semibold">الشعار والهوية</h3>
            
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Official logo</p>
              {branding.logoUrl && (
                <div className="mt-3 p-4 bg-white/5 rounded-2xl flex justify-center border border-white/5">
                  <img src={branding.logoUrl} alt="Logo Preview" className="h-16 object-contain" />
                </div>
              )}
              
              <div className="mt-4 flex gap-3">
                <button onClick={() => logoInputRef.current?.click()} className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold">
                  Upload logo
                </button>
                <input ref={logoInputRef} type="file" className="hidden" onChange={handleLogoUpload} />
              </div>
            </div>

            <TextField
              placeholder="Brand name"
              value={branding.brandName}
              onChange={(e) => setBranding(prev => ({ ...prev, brandName: e.target.value }))}
            />
            <TextField
              placeholder="Hero title"
              value={branding.heroTitle}
              onChange={(e) => setBranding(prev => ({ ...prev, heroTitle: e.target.value }))}
            />
            <TextArea
              rows={4}
              placeholder="Hero body"
              value={branding.heroBody}
              onChange={(e) => setBranding(prev => ({ ...prev, heroBody: e.target.value }))}
            />
          </GlassCard>

          <GlassCard className="p-6 md:p-8 space-y-6">
            <h3 className="text-lg font-semibold">صور الخلفية (Hero Images)</h3>
            {[0, 1].map((index) => (
              <div key={index} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <p className="text-sm font-semibold mb-3">Hero image {index + 1}</p>
                {branding.heroImages[index] && (
                  <img src={branding.heroImages[index]} className="h-32 w-full object-cover rounded-2xl mb-3" alt="Preview" />
                )}
                <button 
                  onClick={() => heroInputRefs[index].current?.click()}
                  className="w-full rounded-2xl bg-white/10 px-4 py-3 text-sm font-semibold"
                >
                  Change Image
                </button>
                <input ref={heroInputRefs[index]} type="file" className="hidden" onChange={(e) => handleHeroUpload(index, e)} />
              </div>
            ))}
          </GlassCard>
        </div>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold mb-6">Banner rotation preview (المعينة)</h2>
          <div className="space-y-6">
            {branding.banners.map((banner, index) => (
              <div key={index} className="rounded-3xl border border-white/10 bg-black/20 p-5 space-y-3">
                <p className="text-cyan-400 text-xs font-bold">BANNER {index + 1}</p>
                
                {banner.image && (
                  <img src={banner.image} className="h-40 w-full object-cover rounded-2xl border border-white/5" alt="Banner Preview" />
                )}

                <div className="grid gap-3">
                  <TextField
                    placeholder="Banner title"
                    value={banner.title}
                    onChange={(e) => {
                      const next = [...branding.banners];
                      next[index].title = e.target.value;
                      setBranding(prev => ({ ...prev, banners: next }));
                    }}
                  />
                  <TextArea
                    placeholder="Banner subtitle"
                    value={banner.subtitle}
                    onChange={(e) => {
                      const next = [...branding.banners];
                      next[index].subtitle = e.target.value;
                      setBranding(prev => ({ ...prev, banners: next }));
                    }}
                  />
                  <div className="flex gap-2">
                    <button 
                      onClick={() => bannerInputRefs[index].current?.click()}
                      className="flex-1 rounded-2xl bg-cyan-500/10 text-cyan-200 border border-cyan-500/20 px-4 py-3 text-sm font-semibold"
                    >
                      Update Banner Image
                    </button>
                    <input ref={bannerInputRefs[index]} type="file" className="hidden" onChange={(e) => handleBannerUpload(index, e)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}