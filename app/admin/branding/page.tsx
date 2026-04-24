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
  primaryColor: string;
  logoUrl: string;
  faviconUrl: string;
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
    primaryColor: DEFAULT_PRIMARY,
    logoUrl: "",
    faviconUrl: "",
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
          primaryColor: String(b.primaryColor ?? DEFAULT_PRIMARY),
          logoUrl: String(b.logoUrl ?? ""),
          faviconUrl: String(b.faviconUrl ?? ""),
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

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/branding", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformName: form.platformName.trim(),
          primaryColor: form.primaryColor.trim(),
          logoUrl: form.logoUrl.trim() || null,
          faviconUrl: form.faviconUrl.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      if (data.branding) {
        setForm({
          platformName: String(data.branding.platformName ?? data.branding.brandName ?? DEFAULT_PLATFORM),
          primaryColor: String(data.branding.primaryColor ?? DEFAULT_PRIMARY),
          logoUrl: String(data.branding.logoUrl ?? ""),
          faviconUrl: String(data.branding.faviconUrl ?? ""),
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
