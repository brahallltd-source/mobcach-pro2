import { getPrisma } from "@/lib/db";
import { getOrCreateSystemSettings } from "@/lib/system-settings";
import { BRANDING } from "@/lib/branding";

export const DEFAULT_PRIMARY = "#0f172a";
export const DEFAULT_PLATFORM = BRANDING.name;

export const defaultMarketingBranding = {
  brandName: BRANDING.name,
  logoUrl: "",
  heroTitle: BRANDING.defaultHeroTitleEn,
  heroBody: BRANDING.defaultHeroBodyEn,
  primaryCta: "Start Recharge",
  secondaryCta: "Become an Agent",
  heroImages: ["/hero/hero-1.svg", "/hero/hero-2.svg"],
  banners: [] as Array<{
    title: string;
    subtitle: string;
    image: string;
    link: string;
    active: boolean;
    order?: number;
  }>,
};

/** Public marketing fields (DB/JSON use plain strings). */
export type NormalizedMarketing = {
  brandName: string;
  logoUrl: string;
  heroTitle: string;
  heroBody: string;
  primaryCta: string;
  secondaryCta: string;
  heroImages: string[];
  banners: Array<{
    title: string;
    subtitle: string;
    image: string;
    link: string;
    active: boolean;
    order?: number;
  }>;
};

export type BrandingSysSlice = {
  platformName: string;
  primaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  /** Optional until DB row is migrated; manifest falls back to empty icons. */
  pwaIcon192?: string | null;
  pwaIcon512?: string | null;
};

function parseMarketingFromMeta(meta: unknown): Record<string, unknown> | null {
  if (meta == null) return null;
  if (typeof meta === "string") {
    try {
      return JSON.parse(meta) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
  if (typeof meta === "object" && !Array.isArray(meta)) {
    return meta as Record<string, unknown>;
  }
  return null;
}

export async function loadMarketingFromAudit(prisma: NonNullable<ReturnType<typeof getPrisma>>) {
  const latest = await prisma.auditLog.findFirst({
    where: { action: "branding_updated", entityType: "branding" },
    orderBy: { createdAt: "desc" },
  });
  const parsed = parseMarketingFromMeta(latest?.meta);
  if (!parsed) return { ...defaultMarketingBranding } as NormalizedMarketing;
  return {
    ...defaultMarketingBranding,
    ...parsed,
    heroImages: Array.isArray(parsed.heroImages)
      ? [...(parsed.heroImages as unknown[]).map(String)]
      : defaultMarketingBranding.heroImages,
    banners: Array.isArray(parsed.banners)
      ? (parsed.banners as typeof defaultMarketingBranding.banners)
      : defaultMarketingBranding.banners,
  } as NormalizedMarketing;
}

export function normalizeHexColor(input: string, fallback: string) {
  const s = String(input || "").trim();
  return /^#[0-9A-Fa-f]{3,8}$/.test(s) ? s : fallback;
}

export function mergePublicBranding(sys: BrandingSysSlice, marketing: NormalizedMarketing) {
  const logoFromSys = String(sys.logoUrl ?? "").trim();
  const logoFromMarketing = String(marketing.logoUrl ?? "").trim();

  return {
    ...marketing,
    platformName: sys.platformName || DEFAULT_PLATFORM,
    primaryColor: normalizeHexColor(sys.primaryColor, DEFAULT_PRIMARY),
    faviconUrl: String(sys.faviconUrl ?? "").trim(),
    pwaIcon192: String(sys.pwaIcon192 ?? "").trim(),
    pwaIcon512: String(sys.pwaIcon512 ?? "").trim(),
    brandName: sys.platformName || marketing.brandName,
    logoUrl: logoFromSys || logoFromMarketing,
  };
}

/** Merged marketing + system settings (same payload as `GET /api/admin/branding`). */
export async function getPublicBrandingMerged() {
  const prisma = getPrisma();
  if (!prisma) {
    return mergePublicBranding(
      {
        platformName: DEFAULT_PLATFORM,
        primaryColor: DEFAULT_PRIMARY,
        logoUrl: null,
        faviconUrl: null,
        pwaIcon192: null,
        pwaIcon512: null,
      },
      { ...defaultMarketingBranding } as NormalizedMarketing
    );
  }

  try {
    const sys = await getOrCreateSystemSettings(prisma);
    const marketing = await loadMarketingFromAudit(prisma);
    return mergePublicBranding(sys, marketing);
  } catch {
    return mergePublicBranding(
      {
        platformName: DEFAULT_PLATFORM,
        primaryColor: DEFAULT_PRIMARY,
        logoUrl: null,
        faviconUrl: null,
        pwaIcon192: null,
        pwaIcon512: null,
      },
      { ...defaultMarketingBranding } as NormalizedMarketing
    );
  }
}
