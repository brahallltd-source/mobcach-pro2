export const dynamic = "force-dynamic";
export const revalidate = 0;

import { writeFile } from "fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getPrisma } from "@/lib/db";
import { getOrCreateSystemSettings } from "@/lib/system-settings";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import {
  defaultMarketingBranding,
  getPublicBrandingMerged,
  loadMarketingFromAudit,
  mergePublicBranding,
  normalizeHexColor,
  type NormalizedMarketing,
} from "@/lib/get-public-branding-merged";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

type PwaPublicFile = "icon-192x192.png" | "icon-512x512.png";

/**
 * PWA icon URL from PATCH body. Returns `undefined` when the field should not change the DB
 * (key absent, or value null / undefined / whitespace-only). Non-destructive: empty clears nothing.
 */
function readPwaIconIncoming(body: Record<string, unknown>, key: string): string | undefined {
  if (!(key in body)) return undefined;
  const v = body[key];
  if (v === null || v === undefined) return undefined;
  const s = String(v).trim();
  if (!s.length) return undefined;
  return s;
}

function assertPngDataUrl(dataUrl: string, label: string) {
  const head = dataUrl.slice(0, 40).toLowerCase();
  if (!head.startsWith("data:image/png")) {
    throw new Error(`${label}: PWA icons must be PNG (image/png).`);
  }
}

async function persistPwaPngDataUrl(dataUrl: string, publicFileName: PwaPublicFile): Promise<string> {
  assertPngDataUrl(dataUrl, publicFileName);
  const comma = dataUrl.indexOf(",");
  if (comma < 0) throw new Error("Malformed PNG data URL.");
  const buf = Buffer.from(dataUrl.slice(comma + 1), "base64");

  const hasCloud =
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;

  if (hasCloud) {
    const publicId =
      publicFileName === "icon-192x192.png" ? "mobcash/branding/pwa/icon-192x192" : "mobcash/branding/pwa/icon-512x512";
    const uploaded = await cloudinary.uploader.upload(dataUrl, {
      public_id: publicId,
      overwrite: true,
      invalidate: true,
      resource_type: "image",
    });
    return uploaded.secure_url;
  }

  const outPath = path.join(process.cwd(), "public", publicFileName);
  try {
    await writeFile(outPath, buf);
  } catch (err) {
    console.error("PWA icon write to public/ failed:", err);
    throw new Error(
      "Could not save PWA icon to public/. Configure Cloudinary (CLOUDINARY_*) or ensure the server can write to public/."
    );
  }
  return `/${publicFileName}`;
}

async function normalizePwaIconField(
  value: string | null | undefined,
  publicFileName: PwaPublicFile
): Promise<string | null | undefined> {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  const s = value.trim();
  if (s.startsWith("data:")) {
    return persistPwaPngDataUrl(s, publicFileName);
  }
  if (s.startsWith("/")) return s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error();
  } catch {
    throw new Error("PWA icon must be a PNG data URL, https URL, or a path starting with /.");
  }
  return s;
}

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

async function normalizeMarketingBranding(input: Record<string, unknown>): Promise<NormalizedMarketing> {
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
  } satisfies NormalizedMarketing;
}

export async function GET() {
  const branding = await getPublicBrandingMerged();
  return NextResponse.json({ branding });
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
    const whatsappSupportNumberRaw =
      body.whatsappSupportNumber != null
        ? String(body.whatsappSupportNumber).replace(/[^\d+]/g, "").trim()
        : undefined;

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

    const rawPwa192 = readPwaIconIncoming(body, "pwaIcon192");
    const rawPwa512 = readPwaIconIncoming(body, "pwaIcon512");
    const pwaIcon192 =
      rawPwa192 !== undefined ? await normalizePwaIconField(rawPwa192, "icon-192x192.png") : undefined;
    const pwaIcon512 =
      rawPwa512 !== undefined ? await normalizePwaIconField(rawPwa512, "icon-512x512.png") : undefined;

    const nextPlatform = platformNameRaw !== undefined ? platformNameRaw.slice(0, 120) : sys.platformName;
    const nextPrimary =
      primaryColorRaw !== undefined ? normalizeHexColor(primaryColorRaw, sys.primaryColor) : sys.primaryColor;

    const pwaThemeColorRaw = body.pwaThemeColor != null ? String(body.pwaThemeColor).trim() : undefined;
    const pwaBgColorRaw = body.pwaBgColor != null ? String(body.pwaBgColor).trim() : undefined;
    const nextPwaTheme =
      pwaThemeColorRaw !== undefined
        ? normalizeHexColor(pwaThemeColorRaw, String(sys.pwaThemeColor ?? "#0f172a"))
        : undefined;
    const nextPwaBg =
      pwaBgColorRaw !== undefined
        ? normalizeHexColor(pwaBgColorRaw, String(sys.pwaBgColor ?? "#0f172a"))
        : undefined;

    const updated = await prisma.systemSettings.update({
      where: { id: sys.id },
      data: {
        ...(platformNameRaw !== undefined ? { platformName: nextPlatform } : {}),
        ...(primaryColorRaw !== undefined ? { primaryColor: nextPrimary } : {}),
        ...(whatsappSupportNumberRaw !== undefined
          ? { whatsappSupportNumber: whatsappSupportNumberRaw || null }
          : {}),
        ...(logoUrl !== undefined ? { logoUrl } : {}),
        ...(faviconUrl !== undefined ? { faviconUrl } : {}),
        ...(pwaIcon192 !== undefined && pwaIcon192 !== null ? { pwaIcon192 } : {}),
        ...(pwaIcon512 !== undefined && pwaIcon512 !== null ? { pwaIcon512 } : {}),
        ...(nextPwaTheme !== undefined ? { pwaThemeColor: nextPwaTheme } : {}),
        ...(nextPwaBg !== undefined ? { pwaBgColor: nextPwaBg } : {}),
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
