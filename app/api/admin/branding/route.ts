export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const defaultBranding = {
  brandName: "GS365Cash",
  logoUrl: "",
  heroTitle: "Recharge made simple, trusted and mobile-first.",
  heroBody:
    "GS365Cash connects players, agents and admins with a clear recharge flow, trusted agent selection and proof-based order confirmation.",
  primaryCta: "Start Recharge",
  secondaryCta: "Become an Agent",
  heroImages: ["/hero/hero-1.svg", "/hero/hero-2.svg"],
  banners: [],
};

async function uploadIfNeeded(value: string, folder: string) {
  const raw = String(value || "").trim();
  if (!raw || !raw.startsWith("data:image/")) return raw;

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

async function normalizeBranding(input: any) {
  const heroImages = Array.isArray(input.heroImages) ? [...input.heroImages] : [];
  const banners = Array.isArray(input.banners) ? [...input.banners] : [];

  const normalizedLogo = await uploadIfNeeded(input.logoUrl, "mobcash/branding/logo");

  const normalizedHeroImages = await Promise.all(
    [0, 1].map(async (index) => {
      const item = String(heroImages[index] || "").trim();
      if (!item || !item.startsWith("data:image/")) return item || (defaultBranding.heroImages[index] || "");
      return uploadIfNeeded(item, "mobcash/branding/hero");
    })
  );

  const normalizedBanners = await Promise.all(
    banners.map(async (banner: any, index: number) => ({
      title: String(banner?.title || "").trim(),
      subtitle: String(banner?.subtitle || "").trim(),
      image: await uploadIfNeeded(String(banner?.image || "").trim(), "mobcash/branding/banners"),
      link: String(banner?.link || "").trim(),
      active: banner?.active !== false,
      order: index,
    }))
  );

  return {
    brandName: String(input.brandName || defaultBranding.brandName).trim(),
    logoUrl: normalizedLogo,
    heroTitle: String(input.heroTitle || defaultBranding.heroTitle).trim(),
    heroBody: String(input.heroBody || defaultBranding.heroBody).trim(),
    primaryCta: String(input.primaryCta || defaultBranding.primaryCta).trim(),
    secondaryCta: String(input.secondaryCta || defaultBranding.secondaryCta).trim(),
    heroImages: normalizedHeroImages,
    banners: normalizedBanners.length > 0 ? normalizedBanners : defaultBranding.banners,
  };
}

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ branding: defaultBranding });

    const latest = await prisma.auditLog.findFirst({
      where: { action: "branding_updated", entityType: "branding" },
      orderBy: { createdAt: "desc" },
    });

    if (!latest?.meta) return NextResponse.json({ branding: defaultBranding });

    // التأكد من دمج البيانات المحفوظة مع القيم الافتراضية بدقة
    const saved = latest.meta as any;
    return NextResponse.json({
      branding: {
        ...defaultBranding,
        ...saved,
      },
    });
  } catch (error) {
    return NextResponse.json({ branding: defaultBranding });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const body = await req.json();
    const normalized = await normalizeBranding(body.branding || body);

    await prisma.auditLog.create({
      data: {
        action: "branding_updated",
        entityType: "branding",
        entityId: "global",
        meta: normalized,
      },
    });

    return NextResponse.json({ message: "Saved", branding: normalized });
  } catch (error: any) {
    return NextResponse.json({ message: error.message }, { status: 500 });
  }
}