export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getPrisma } from "@/lib/db";
import { getOrCreateSystemSettings } from "@/lib/system-settings";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { BRANDING } from "@/lib/branding";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const DEFAULT_PRIMARY = "#0f172a";
const DEFAULT_PLATFORM = BRANDING.name;

const defaultMarketingBranding = {
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

async function uploadIfNeeded(value: string, folder: string) {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("data:image/")) return raw;

  const hasCloud =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;
  if (!hasCloud) {
    console.warn("Branding upload: Cloudinary env missing; keeping data URL (not recommended for production).");
    return raw;
  }

  try {
    const uploaded = await cloudinary.uploader.upload(raw, {
      folder,
      resource_type: "image",
    });
    return uploaded.secure_url;
  } catch (err) {
    console.error("Cloudinary Upload Error:", err);
    return raw;
  }
}

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

async function loadMarketingFromAudit(prisma: NonNullable<ReturnType<typeof getPrisma>>) {
  const latest = await prisma.auditLog.findFirst({
    where: { action: "branding_updated", entityType: "branding" },
    orderBy: { createdAt: "desc" },
  });
  const parsed = parseMarketingFromMeta(latest?.meta);
  if (!parsed) return { ...defaultMarketingBranding };
  return {
    ...defaultMarketingBranding,
    ...parsed,
    heroImages: Array.isArray(parsed.heroImages)
      ? [...(parsed.heroImages as unknown[]).map(String)]
      : defaultMarketingBranding.heroImages,
    banners: Array.isArray(parsed.banners) ? (parsed.banners as typeof defaultMarketingBranding.banners) : defaultMarketingBranding.banners,
  };
}

function normalizeHexColor(input: string, fallback: string) {
  const s = String(input || "").trim();
  return /^#[0-9A-Fa-f]{3,8}$/.test(s) ? s : fallback;
}

type BrandingSysSlice = {
  platformName: string;
  primaryColor: string;
  logoUrl: string | null;
  faviconUrl: string | null;
};

function mergePublicBranding(sys: BrandingSysSlice, marketing: typeof defaultMarketingBranding) {
  const logoFromSys = String(sys.logoUrl ?? "").trim();
  const logoFromMarketing = String(marketing.logoUrl ?? "").trim();

  return {
    ...marketing,
    platformName: sys.platformName || DEFAULT_PLATFORM,
    primaryColor: normalizeHexColor(sys.primaryColor, DEFAULT_PRIMARY),
    faviconUrl: String(sys.faviconUrl ?? "").trim(),
    brandName: sys.platformName || marketing.brandName,
    logoUrl: logoFromSys || logoFromMarketing,
  };
}

async function normalizeMarketingBranding(input: Record<string, unknown>) {
  const heroImages = Array.isArray(input.heroImages) ? [...input.heroImages] : [];
  const banners = Array.isArray(input.banners) ? [...input.banners] : [];

  const normalizedLogo = await uploadIfNeeded(String(input.logoUrl ?? ""), "mobcash/branding/logo");

  const normalizedHeroImages = await Promise.all(
    [0, 1].map(async (index) => {
      const item = String(heroImages[index] || "").trim();
      if (!item || !item.startsWith("data:image/")) return item || (defaultMarketingBranding.heroImages[index] || "");
      return uploadIfNeeded(item, "mobcash/branding/hero");
    })
  );

  const normalizedBanners = await Promise.all(
    banners.map(async (banner: Record<string, unknown>, index: number) => ({
      title: String(banner?.title || "").trim(),
      subtitle: String(banner?.subtitle || "").trim(),
      image: await uploadIfNeeded(String(banner?.image || "").trim(), "mobcash/branding/banners"),
      link: String(banner?.link || "").trim(),
      active: banner?.active !== false,
      order: index,
    }))
  );

  return {
    brandName: String(input.brandName || defaultMarketingBranding.brandName).trim(),
    logoUrl: normalizedLogo,
    heroTitle: String(input.heroTitle || defaultMarketingBranding.heroTitle).trim(),
    heroBody: String(input.heroBody || defaultMarketingBranding.heroBody).trim(),
    primaryCta: String(input.primaryCta || defaultMarketingBranding.primaryCta).trim(),
    secondaryCta: String(input.secondaryCta || defaultMarketingBranding.secondaryCta).trim(),
    heroImages: normalizedHeroImages,
    banners: normalizedBanners.length > 0 ? normalizedBanners : defaultMarketingBranding.banners,
  };
}

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({
        branding: mergePublicBranding(
          {
            platformName: DEFAULT_PLATFORM,
            primaryColor: DEFAULT_PRIMARY,
            logoUrl: null,
            faviconUrl: null,
          },
          { ...defaultMarketingBranding }
        ),
      });
    }

    const sys = await getOrCreateSystemSettings(prisma);
    const marketing = await loadMarketingFromAudit(prisma);
    return NextResponse.json({
      branding: mergePublicBranding(sys, marketing),
    });
  } catch {
    return NextResponse.json({
      branding: mergePublicBranding(
        {
          platformName: DEFAULT_PLATFORM,
          primaryColor: DEFAULT_PRIMARY,
          logoUrl: null,
          faviconUrl: null,
        },
        { ...defaultMarketingBranding }
      ),
    });
  }
}

export async function PATCH(req: Request) {
  const access = await requireAdminPermission("MANAGE_SETTINGS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database not available" }, { status: 500 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const sys = await getOrCreateSystemSettings(prisma);

    const platformNameRaw = body.platformName != null ? String(body.platformName).trim() : undefined;
    const primaryColorRaw = body.primaryColor != null ? String(body.primaryColor).trim() : undefined;

    let logoUrl: string | null | undefined =
      body.logoUrl !== undefined ? (String(body.logoUrl).trim() || null) : undefined;
    let faviconUrl: string | null | undefined =
      body.faviconUrl !== undefined ? (String(body.faviconUrl).trim() || null) : undefined;

    if (typeof logoUrl === "string" && logoUrl.startsWith("data:image/")) {
      logoUrl = await uploadIfNeeded(logoUrl, "mobcash/branding/platform-logo");
    }
    if (typeof faviconUrl === "string" && faviconUrl.startsWith("data:image/")) {
      faviconUrl = await uploadIfNeeded(faviconUrl, "mobcash/branding/favicon");
    }

    const nextPlatform = platformNameRaw !== undefined ? platformNameRaw.slice(0, 120) : sys.platformName;
    const nextPrimary =
      primaryColorRaw !== undefined ? normalizeHexColor(primaryColorRaw, sys.primaryColor) : sys.primaryColor;

    const updated = await prisma.systemSettings.update({
      where: { id: sys.id },
      data: {
        ...(platformNameRaw !== undefined ? { platformName: nextPlatform } : {}),
        ...(primaryColorRaw !== undefined ? { primaryColor: nextPrimary } : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(faviconUrl !== undefined ? { faviconUrl } : {}),
      },
    });

    const marketing = await loadMarketingFromAudit(prisma);
    return NextResponse.json({
      message: "Saved",
      branding: mergePublicBranding(updated, marketing),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Update failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}

/** Full marketing bundle (hero, banners). Requires `branding` permission. */
export async function POST(req: Request) {
  const access = await requireAdminPermission("MANAGE_SETTINGS");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ message: "Database not available" }, { status: 500 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const payload = (body.branding && typeof body.branding === "object" ? body.branding : body) as Record<
      string,
      unknown
    >;
    const normalized = await normalizeMarketingBranding(payload);

    await prisma.auditLog.create({
      data: {
        userId: access.user.id,
        action: "branding_updated",
        entityType: "branding",
        entityId: "global",
        meta: normalized as object,
      },
    });

    const sys = await getOrCreateSystemSettings(prisma);
    return NextResponse.json({
      message: "Saved",
      branding: mergePublicBranding(sys, normalized),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Save failed";
    return NextResponse.json({ message }, { status: 500 });
  }
}
