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

  const heroInputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];
  const bannerInputRefs = [
    useRef<HTMLInputElement | null>(null),
    useRef<HTMLInputElement | null>(null),
  ];
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch("/api/admin/branding", { cache: "no-store" });
      const data = await res.json();
      localStorage.setItem(
  "mobcash_branding",
  JSON.stringify({ ...defaultBranding, ...(data.branding || {}) })
);
    };

    void load();
  }, []);

  const save = async () => {
    try {
      setSaving(true);

      const res = await fetch("/api/admin/branding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });

      const data = await res.json();

      if (!res.ok) {
        alert(data.message || "Failed to save branding");
        return;
      }

      localStorage.setItem(
  "mobcash_branding",
  JSON.stringify({ ...defaultBranding, ...(data.branding || {}) })
);
      alert("Branding saved successfully");
    } finally {
      setSaving(false);
    }
  };

  const readImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return null;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      alert("Please upload PNG, JPG, SVG or WEBP only.");
      event.target.value = "";
      return null;
    }

    const image = await fileToDataUrl(file);
    event.target.value = "";
    return image;
  };

  const handleHeroUpload = async (
    index: number,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const image = await readImage(event);
    if (!image) return;

    setBranding((prev) => {
      const heroImages = [...(prev.heroImages || [])];
      heroImages[index] = image;
      return { ...prev, heroImages };
    });
  };

  const handleBannerUpload = async (
    index: number,
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const image = await readImage(event);
    if (!image) return;

    setBranding((prev) => {
      const next = [...prev.banners];
      next[index] = { ...next[index], image };
      return { ...prev, banners: next };
    });
  };

  const handleLogoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const image = await readImage(event);
    if (!image) return;
    setBranding((prev) => ({ ...prev, logoUrl: image }));
  };

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Branding panel"
        subtitle="Upload PNG logos to Cloudinary and keep branding permanent until the admin changes it again."
      />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <GlassCard className="p-6 md:p-8">
          <div className="grid gap-4">
            <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
              <p className="text-sm font-semibold text-white">Official logo</p>
              <p className="mt-1 text-xs text-white/45">
                Upload the official brand logo once and reuse it automatically on
                every page.
              </p>

              <TextField
                className="mt-3"
                placeholder="Logo URL or uploaded image"
                value={branding.logoUrl}
                onChange={(e) =>
                  setBranding((prev) => ({ ...prev, logoUrl: e.target.value }))
                }
              />

              <input
                ref={logoInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={(e) => void handleLogoUpload(e)}
              />

              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Upload logo
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setBranding((prev) => ({ ...prev, logoUrl: "" }))
                  }
                  className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10"
                >
                  Reset logo
                </button>
              </div>
            </div>

            <TextField
              placeholder="Brand name"
              value={branding.brandName}
              onChange={(e) =>
                setBranding((prev) => ({ ...prev, brandName: e.target.value }))
              }
            />

            <TextField
              placeholder="Hero title"
              value={branding.heroTitle}
              onChange={(e) =>
                setBranding((prev) => ({ ...prev, heroTitle: e.target.value }))
              }
            />

            <TextArea
              rows={5}
              placeholder="Hero body"
              value={branding.heroBody}
              onChange={(e) =>
                setBranding((prev) => ({ ...prev, heroBody: e.target.value }))
              }
            />

            <TextField
              placeholder="Primary CTA"
              value={branding.primaryCta}
              onChange={(e) =>
                setBranding((prev) => ({ ...prev, primaryCta: e.target.value }))
              }
            />

            <TextField
              placeholder="Secondary CTA"
              value={branding.secondaryCta}
              onChange={(e) =>
                setBranding((prev) => ({
                  ...prev,
                  secondaryCta: e.target.value,
                }))
              }
            />

            {[0, 1].map((index) => (
              <div
                key={index}
                className="rounded-3xl border border-white/10 bg-black/20 p-4"
              >
                <p className="text-sm font-semibold text-white">
                  Hero image {index + 1}
                </p>

                <TextField
                  className="mt-3"
                  placeholder={`Hero image ${index + 1}`}
                  value={branding.heroImages[index] || ""}
                  onChange={(e) =>
                    setBranding((prev) => {
                      const heroImages = [...(prev.heroImages || [])];
                      heroImages[index] = e.target.value;
                      return { ...prev, heroImages };
                    })
                  }
                />

                <input
                  ref={heroInputRefs[index]}
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => void handleHeroUpload(index, e)}
                />

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => heroInputRefs[index].current?.click()}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Upload image
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setBranding((prev) => {
                        const heroImages = [...(prev.heroImages || [])];
                        heroImages[index] =
                          defaultBranding.heroImages[index] || "";
                        return { ...prev, heroImages };
                      })
                    }
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ))}

            <PrimaryButton
              onClick={save}
              disabled={saving}
              className="w-full md:w-auto"
            >
              {saving ? "Saving..." : "Save branding"}
            </PrimaryButton>
          </div>
        </GlassCard>

        <GlassCard className="p-6 md:p-8">
          <h2 className="text-2xl font-semibold">Banner rotation preview</h2>

          <div className="mt-5 space-y-4">
            {branding.banners.map((banner, index) => (
              <div
                key={index}
                className="rounded-3xl border border-white/10 bg-black/20 p-5"
              >
                <TextField
                  placeholder="Banner title"
                  value={banner.title}
                  onChange={(e) => {
                    const next = [...branding.banners];
                    next[index] = { ...next[index], title: e.target.value };
                    setBranding((prev) => ({ ...prev, banners: next }));
                  }}
                />

                <TextArea
                  rows={3}
                  placeholder="Banner subtitle"
                  value={banner.subtitle}
                  onChange={(e) => {
                    const next = [...branding.banners];
                    next[index] = { ...next[index], subtitle: e.target.value };
                    setBranding((prev) => ({ ...prev, banners: next }));
                  }}
                  className="mt-3"
                />

                <TextField
                  placeholder="Banner image"
                  value={banner.image}
                  onChange={(e) => {
                    const next = [...branding.banners];
                    next[index] = { ...next[index], image: e.target.value };
                    setBranding((prev) => ({ ...prev, banners: next }));
                  }}
                  className="mt-3"
                />

                <TextField
                  placeholder="Banner link"
                  value={banner.link}
                  onChange={(e) => {
                    const next = [...branding.banners];
                    next[index] = { ...next[index], link: e.target.value };
                    setBranding((prev) => ({ ...prev, banners: next }));
                  }}
                  className="mt-3"
                />

                <input
                  ref={bannerInputRefs[index]}
                  type="file"
                  accept=".png,.jpg,.jpeg,.svg,.webp,image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => void handleBannerUpload(index, e)}
                />

                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => bannerInputRefs[index].current?.click()}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Upload image
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setBranding((prev) => {
                        const next = [...prev.banners];
                        next[index] = {
                          ...next[index],
                          image: defaultBranding.banners[index]?.image || "",
                        };
                        return { ...prev, banners: next };
                      })
                    }
                    className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold text-white/75 transition hover:bg-white/10"
                  >
                    Reset image
                  </button>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </SidebarShell>
  );
}