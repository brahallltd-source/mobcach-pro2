"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import { Image as ImageIcon, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { GlassCard, PageHeader, PrimaryButton, SidebarShell, Switch, TextField } from "@/components/ui";
import { BRANDING } from "@/lib/branding";

const ACCEPTED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

const DEFAULT_PLATFORM = BRANDING.name;
const DEFAULT_PRIMARY = "#0f172a";

type VisualBranding = {
  platformName: string;
  whatsappSupportNumber: string;
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
  pwaIcon192: string;
  pwaIcon512: string;
  pwaThemeColor: string;
  pwaBgColor: string;
};

type SocialBranding = {
  facebook: string;
  instagram: string;
  telegram: string;
  gmail: string;
  websiteUrl: string;
  showFb: boolean;
  showInsta: boolean;
  showTele: boolean;
};

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}

export default function AdminBrandingPage() {
  const router = useRouter();
  const [form, setForm] = useState<VisualBranding>({
    platformName: DEFAULT_PLATFORM,
    whatsappSupportNumber: "",
    primaryColor: DEFAULT_PRIMARY,
    logoUrl: "",
    faviconUrl: "",
    pwaIcon192: "",
    pwaIcon512: "",
    pwaThemeColor: DEFAULT_PRIMARY,
    pwaBgColor: DEFAULT_PRIMARY,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [social, setSocial] = useState<SocialBranding>({
    facebook: "",
    instagram: "",
    telegram: "",
    gmail: "",
    websiteUrl: "https://gosport365.com",
    showFb: true,
    showInsta: true,
    showTele: true,
  });
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialSaving, setSocialSaving] = useState(false);
  const [socialForbidden, setSocialForbidden] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const pwa192InputRef = useRef<HTMLInputElement>(null);
  const pwa512InputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/branding", { cache: "no-store", credentials: "include" });
      const data = await res.json();
      const b = data.branding;
      if (b) {
        setForm({
          platformName: String(b.platformName ?? b.brandName ?? DEFAULT_PLATFORM),
          whatsappSupportNumber: String(b.whatsappSupportNumber ?? ""),
          primaryColor: String(b.primaryColor ?? DEFAULT_PRIMARY),
          logoUrl: String(b.logoUrl ?? ""),
          faviconUrl: String(b.faviconUrl ?? ""),
          pwaIcon192: String(b.pwaIcon192 ?? ""),
          pwaIcon512: String(b.pwaIcon512 ?? ""),
          pwaThemeColor: String(b.pwaThemeColor ?? DEFAULT_PRIMARY),
          pwaBgColor: String(b.pwaBgColor ?? DEFAULT_PRIMARY),
        });
      }
    } catch {
      setMessage("Could not load branding.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const loadSocial = useCallback(async () => {
    setSocialLoading(true);
    setSocialForbidden(false);
    try {
      const res = await fetch("/api/admin/branding-settings", { cache: "no-store", credentials: "include" });
      if (res.status === 403) {
        setSocialForbidden(true);
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load social branding");
      const s = data.settings;
      if (s && typeof s === "object") {
        setSocial({
          facebook: String(s.facebook ?? ""),
          instagram: String(s.instagram ?? ""),
          telegram: String(s.telegram ?? ""),
          gmail: String(s.gmail ?? ""),
          websiteUrl: String(s.websiteUrl ?? "https://gosport365.com"),
          showFb: Boolean(s.showFb !== false),
          showInsta: Boolean(s.showInsta !== false),
          showTele: Boolean(s.showTele !== false),
        });
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not load contact branding");
    } finally {
      setSocialLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSocial();
  }, [loadSocial]);

  const saveSocial = async () => {
    setSocialSaving(true);
    try {
      const res = await fetch("/api/admin/branding-settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(social),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      if (data.settings) {
        const s = data.settings;
        setSocial({
          facebook: String(s.facebook ?? ""),
          instagram: String(s.instagram ?? ""),
          telegram: String(s.telegram ?? ""),
          gmail: String(s.gmail ?? ""),
          websiteUrl: String(s.websiteUrl ?? "https://gosport365.com"),
          showFb: Boolean(s.showFb),
          showInsta: Boolean(s.showInsta),
          showTele: Boolean(s.showTele),
        });
      }
      toast.success("Contact & social links saved.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSocialSaving(false);
    }
  };

  const readImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return null;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setMessage("Please use PNG, JPG, SVG, WEBP, or ICO.");
      return null;
    }
    return fileToDataUrl(file);
  };

  const readPwaPngOnly = async (event: ChangeEvent<HTMLInputElement>, label: string) => {
    const file = event.target.files?.[0];
    if (!file) return null;
    if (file.type !== "image/png") {
      toast.error(`${label}: PWA icons must be PNG (image/png) only.`);
      return null;
    }
    const dataUrl = await fileToDataUrl(file);
    if (!dataUrl.toLowerCase().startsWith("data:image/png")) {
      toast.error(`${label}: file must be a valid PNG.`);
      return null;
    }
    return dataUrl;
  };

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        platformName: form.platformName.trim(),
        whatsappSupportNumber: form.whatsappSupportNumber.trim() || null,
        primaryColor: form.primaryColor.trim(),
        logoUrl: form.logoUrl.trim() || null,
        faviconUrl: form.faviconUrl.trim() || null,
        pwaThemeColor: form.pwaThemeColor.trim(),
        pwaBgColor: form.pwaBgColor.trim(),
      };
      const p192 = form.pwaIcon192.trim();
      const p512 = form.pwaIcon512.trim();
      if (p192) payload.pwaIcon192 = p192;
      if (p512) payload.pwaIcon512 = p512;

      const res = await fetch("/api/admin/branding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      if (data.branding) {
        setForm({
          platformName: String(data.branding.platformName ?? data.branding.brandName ?? DEFAULT_PLATFORM),
          whatsappSupportNumber: String(data.branding.whatsappSupportNumber ?? ""),
          primaryColor: String(data.branding.primaryColor ?? DEFAULT_PRIMARY),
          logoUrl: String(data.branding.logoUrl ?? ""),
          faviconUrl: String(data.branding.faviconUrl ?? ""),
          pwaIcon192: String(data.branding.pwaIcon192 ?? ""),
          pwaIcon512: String(data.branding.pwaIcon512 ?? ""),
          pwaThemeColor: String(data.branding.pwaThemeColor ?? DEFAULT_PRIMARY),
          pwaBgColor: String(data.branding.pwaBgColor ?? DEFAULT_PRIMARY),
        });
      }
      setMessage("Saved. Theme updates apply site-wide after refresh.");
      router.refresh();
    } catch (e: unknown) {
      setMessage(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <SidebarShell role="admin">
      <PageHeader
        title="Platform branding"
        subtitle="Name, accent color, logo and favicon. Changes apply globally via CSS variables and metadata."
        action={
          <PrimaryButton onClick={() => void save()} disabled={saving || loading}>
            {saving ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Save className="mr-2 inline h-4 w-4" />
                Save
              </>
            )}
          </PrimaryButton>
        }
      />

      {message ? (
        <p className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/80">{message}</p>
      ) : null}

      {loading ? (
        <GlassCard className="p-10 text-center text-white/60">Loading…</GlassCard>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
          <div className="space-y-6">
            <GlassCard className="space-y-5 p-6 md:p-8">
              <h2 className="text-lg font-semibold text-white">Visual identity</h2>
              <TextField
                placeholder="Platform name"
                value={form.platformName}
                onChange={(e) => setForm((f) => ({ ...f, platformName: e.target.value }))}
              />
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">
                  رقم WhatsApp للدعم الفني
                </label>
                <TextField
                  placeholder="212612345678"
                  value={form.whatsappSupportNumber}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      whatsappSupportNumber: e.target.value.replace(/[^\d+]/g, ""),
                    }))
                  }
                />
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div className="min-w-0 flex-1">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-white/45">
                    Primary color
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="color"
                      aria-label="Primary color"
                      value={/^#[0-9A-Fa-f]{6}$/i.test(form.primaryColor) ? form.primaryColor : DEFAULT_PRIMARY}
                      onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                      className="h-12 w-14 cursor-pointer overflow-hidden rounded-xl border border-white/15 bg-black/30 p-1"
                    />
                    <TextField
                      className="flex-1 font-mono text-sm"
                      placeholder="#0f172a"
                      value={form.primaryColor}
                      onChange={(e) => setForm((f) => ({ ...f, primaryColor: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Logo</p>
                  {form.logoUrl ? (
                    <div className="mt-3 flex h-24 items-center justify-center rounded-xl bg-white/5 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="mt-3 flex h-24 items-center justify-center rounded-xl border border-dashed border-white/15 text-white/35">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="mt-3 w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Upload logo
                  </button>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    className="hidden"
                    onChange={async (e) => {
                      const img = await readImage(e);
                      if (img) setForm((f) => ({ ...f, logoUrl: img }));
                      e.target.value = "";
                    }}
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/50">Favicon</p>
                  {form.faviconUrl ? (
                    <div className="mt-3 flex h-24 items-center justify-center rounded-xl bg-white/5 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.faviconUrl} alt="" className="h-14 w-14 object-contain" />
                    </div>
                  ) : (
                    <div className="mt-3 flex h-24 items-center justify-center rounded-xl border border-dashed border-white/15 text-white/35">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => faviconInputRef.current?.click()}
                    className="mt-3 w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Upload favicon
                  </button>
                  <input
                    ref={faviconInputRef}
                    type="file"
                    accept={ACCEPTED_TYPES.join(",")}
                    className="hidden"
                    onChange={async (e) => {
                      const img = await readImage(e);
                      if (img) setForm((f) => ({ ...f, faviconUrl: img }));
                      e.target.value = "";
                    }}
                  />
                </div>
              </div>
            </GlassCard>

            <GlassCard className="space-y-6 border-primary/20 bg-gradient-to-b from-white/[0.06] to-black/20 p-6 md:p-8 ring-1 ring-primary/15">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">PWA &amp; Mobile App Icons</h2>
                <p className="mt-1 text-base font-medium text-primary" dir="rtl">
                  أيقونات التطبيق والهاتف
                </p>
                <p className="mt-2 text-sm text-white/55">
                  PNG only (required for PWA). Saving other branding without re-uploading leaves existing icons
                  unchanged. Theme colors apply to the Web App Manifest.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm font-semibold text-white">PWA Icon (192x192 PNG)</p>
                  <p className="mt-1 text-xs text-white/45">Home screen shortcut after install.</p>
                  <button
                    type="button"
                    onClick={() => pwa192InputRef.current?.click()}
                    className="mt-4 w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Choose PNG file…
                  </button>
                  <input
                    ref={pwa192InputRef}
                    type="file"
                    accept="image/png,.png"
                    className="hidden"
                    onChange={async (e) => {
                      const img = await readPwaPngOnly(e, "PWA Icon (192x192 PNG)");
                      if (img) setForm((f) => ({ ...f, pwaIcon192: img }));
                      e.target.value = "";
                    }}
                  />
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-white/50">Saved icon</p>
                  {form.pwaIcon192 ? (
                    <div className="mt-2 flex h-28 items-center justify-center rounded-xl bg-white/5 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.pwaIcon192} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="mt-2 flex h-28 items-center justify-center rounded-xl border border-dashed border-white/15 text-white/35">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <p className="text-sm font-semibold text-white">PWA Icon (512x512 PNG)</p>
                  <p className="mt-1 text-xs text-white/45">Splash / high-resolution contexts.</p>
                  <button
                    type="button"
                    onClick={() => pwa512InputRef.current?.click()}
                    className="mt-4 w-full rounded-xl bg-white/10 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
                  >
                    Choose PNG file…
                  </button>
                  <input
                    ref={pwa512InputRef}
                    type="file"
                    accept="image/png,.png"
                    className="hidden"
                    onChange={async (e) => {
                      const img = await readPwaPngOnly(e, "PWA Icon (512x512 PNG)");
                      if (img) setForm((f) => ({ ...f, pwaIcon512: img }));
                      e.target.value = "";
                    }}
                  />
                  <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-white/50">Saved icon</p>
                  {form.pwaIcon512 ? (
                    <div className="mt-2 flex h-28 items-center justify-center rounded-xl bg-white/5 p-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={form.pwaIcon512} alt="" className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <div className="mt-2 flex h-28 items-center justify-center rounded-xl border border-dashed border-white/15 text-white/35">
                      <ImageIcon className="h-8 w-8" />
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/55">Manifest colors</h3>
              </div>

              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/50">
                    Theme color
                  </label>
                  <p className="text-xs text-white/45">Controls the mobile status bar and browser chrome tint.</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="color"
                      aria-label="PWA theme color"
                      value={/^#[0-9A-Fa-f]{6}$/i.test(form.pwaThemeColor) ? form.pwaThemeColor : DEFAULT_PRIMARY}
                      onChange={(e) => setForm((f) => ({ ...f, pwaThemeColor: e.target.value }))}
                      className="h-12 w-14 cursor-pointer overflow-hidden rounded-xl border border-white/15 bg-black/30 p-1"
                    />
                    <TextField
                      className="min-w-[10rem] flex-1 font-mono text-sm"
                      placeholder="#0f172a"
                      value={form.pwaThemeColor}
                      onChange={(e) => setForm((f) => ({ ...f, pwaThemeColor: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-white/50">
                    Background color
                  </label>
                  <p className="text-xs text-white/45">Splash screen background while the app loads.</p>
                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="color"
                      aria-label="PWA background color"
                      value={/^#[0-9A-Fa-f]{6}$/i.test(form.pwaBgColor) ? form.pwaBgColor : DEFAULT_PRIMARY}
                      onChange={(e) => setForm((f) => ({ ...f, pwaBgColor: e.target.value }))}
                      className="h-12 w-14 cursor-pointer overflow-hidden rounded-xl border border-white/15 bg-black/30 p-1"
                    />
                    <TextField
                      className="min-w-[10rem] flex-1 font-mono text-sm"
                      placeholder="#0f172a"
                      value={form.pwaBgColor}
                      onChange={(e) => setForm((f) => ({ ...f, pwaBgColor: e.target.value }))}
                    />
                  </div>
                </div>
              </div>
            </GlassCard>
          </div>

          <GlassCard className="p-6 md:p-8">
            <h2 className="mb-4 text-lg font-semibold text-white">Live preview</h2>
            <p className="mb-6 text-sm text-white/55">Agent login card uses your draft values (not saved until you click Save).</p>

            <div className="mx-auto max-w-md rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-black/40 p-6 shadow-glass">
              <div className="mb-6 flex items-center gap-3">
                {form.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logoUrl} alt="" className="h-11 w-11 rounded-xl object-contain" />
                ) : (
                  <div
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-bold text-white"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    {form.platformName.trim().slice(0, 1).toUpperCase() || "M"}
                  </div>
                )}
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/45">Agent workspace</p>
                  <p className="text-lg font-semibold text-white">{form.platformName.trim() || DEFAULT_PLATFORM}</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-white/50">Email or username</label>
                  <div className="mt-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/40">agent@example.com</div>
                </div>
                <div>
                  <label className="text-xs text-white/50">Password</label>
                  <div className="mt-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white/40">••••••••</div>
                </div>
                <button
                  type="button"
                  className="mt-2 w-full rounded-2xl py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                  style={{ backgroundColor: form.primaryColor }}
                >
                  Sign in
                </button>
              </div>
            </div>

            <div
              className="mt-8 rounded-2xl border border-white/10 p-4"
              style={{ borderLeftWidth: 4, borderLeftColor: form.primaryColor }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-white/45">Sidebar snippet</p>
              <div className="mt-3 flex items-center gap-2">
                <span
                  className="inline-block h-8 w-1 rounded-full"
                  style={{ backgroundColor: form.primaryColor }}
                />
                <span className="text-sm font-medium text-white">{form.platformName.trim() || DEFAULT_PLATFORM}</span>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {socialForbidden ? (
        <GlassCard className="mt-8 p-6 text-sm text-white/60">
          Contact &amp; social links are restricted to <span className="text-white/90">Super Admin</span> only.
        </GlassCard>
      ) : socialLoading ? (
        <GlassCard className="mt-8 p-10 text-center text-white/60">Loading contact branding…</GlassCard>
      ) : (
        <GlassCard className="mt-8 space-y-6 p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Contact &amp; social (public)</h2>
              <p className="mt-1 text-sm text-white/50">
                Shown on the player profile footer. Toggle visibility per network.
              </p>
            </div>
            <PrimaryButton onClick={() => void saveSocial()} disabled={socialSaving}>
              {socialSaving ? (
                <>
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 inline h-4 w-4" />
                  Save social
                </>
              )}
            </PrimaryButton>
          </div>

          <TextField
            placeholder="Website URL"
            value={social.websiteUrl}
            onChange={(e) => setSocial((s) => ({ ...s, websiteUrl: e.target.value }))}
          />
          <TextField
            placeholder="Gmail / support email"
            value={social.gmail}
            onChange={(e) => setSocial((s) => ({ ...s, gmail: e.target.value }))}
          />

          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-white/80">Facebook</span>
                <Switch
                  checked={social.showFb}
                  onCheckedChange={(next) => setSocial((s) => ({ ...s, showFb: next }))}
                  aria-label="Show Facebook"
                />
              </div>
              <TextField
                placeholder="https://facebook.com/…"
                value={social.facebook}
                onChange={(e) => setSocial((s) => ({ ...s, facebook: e.target.value }))}
              />
            </div>
            <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-white/80">Instagram</span>
                <Switch
                  checked={social.showInsta}
                  onCheckedChange={(next) => setSocial((s) => ({ ...s, showInsta: next }))}
                  aria-label="Show Instagram"
                />
              </div>
              <TextField
                placeholder="https://instagram.com/…"
                value={social.instagram}
                onChange={(e) => setSocial((s) => ({ ...s, instagram: e.target.value }))}
              />
            </div>
            <div className="space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-white/80">Telegram</span>
                <Switch
                  checked={social.showTele}
                  onCheckedChange={(next) => setSocial((s) => ({ ...s, showTele: next }))}
                  aria-label="Show Telegram"
                />
              </div>
              <TextField
                placeholder="https://t.me/…"
                value={social.telegram}
                onChange={(e) => setSocial((s) => ({ ...s, telegram: e.target.value }))}
              />
            </div>
          </div>
        </GlassCard>
      )}
    </SidebarShell>
  );
}
