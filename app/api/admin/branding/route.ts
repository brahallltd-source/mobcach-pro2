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

async function uploadIfNeeded(value: string, folder: string) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (!raw.startsWith("data:image/")) return raw;

  const uploaded = await cloudinary.uploader.upload(raw, {
    folder,
    resource_type: "image",
  });

  return uploaded.secure_url;
}

async function normalizeBranding(input: any) {
  const heroImages = Array.isArray(input.heroImages) ? [...input.heroImages] : [];
  const banners = Array.isArray(input.banners) ? [...input.banners] : [];

  const normalizedHeroImages = await Promise.all(
    [0, 1].map(async (index) => {
      const item = String(heroImages[index] || "").trim();
      if (!item) return defaultBranding.heroImages[index] || "";
      return uploadIfNeeded(item, "mobcash/branding/hero");
    })
  );

  const normalizedBanners = await Promise.all(
    banners.map(async (banner: any, index: number) => ({
      title: String(banner?.title || "").trim(),
      subtitle: String(banner?.subtitle || "").trim(),
      image: await uploadIfNeeded(
        String(banner?.image || "").trim(),
        "mobcash/branding/banners"
      ),
      link: String(banner?.link || "").trim(),
      active: banner?.active !== false,
      order: index,
    }))
  );

  return {
    brandName: String(input.brandName || defaultBranding.brandName).trim(),
    logoUrl: await uploadIfNeeded(
      String(input.logoUrl || "").trim(),
      "mobcash/branding/logo"
    ),
    heroTitle: String(input.heroTitle || defaultBranding.heroTitle).trim(),
    heroBody: String(input.heroBody || defaultBranding.heroBody).trim(),
    primaryCta: String(input.primaryCta || defaultBranding.primaryCta).trim(),
    secondaryCta: String(input.secondaryCta || defaultBranding.secondaryCta).trim(),
    heroImages: normalizedHeroImages,
    banners:
      normalizedBanners.length > 0 ? normalizedBanners : defaultBranding.banners,
  };
}

export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ branding: defaultBranding }, { status: 200 });
    }

    const latest = await prisma.auditLog.findFirst({
      where: {
        action: "branding_updated",
        entityType: "branding",
        entityId: "global",
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (!latest?.meta) {
      return NextResponse.json({ branding: defaultBranding }, { status: 200 });
    }

    return NextResponse.json({
      branding: {
        ...defaultBranding,
        ...(latest.meta as Record<string, any>),
      },
    });
  } catch (error) {
    console.error("GET BRANDING ERROR:", error);
    return NextResponse.json({ branding: defaultBranding }, { status: 200 });
  }
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const body = await req.json();
    const normalized = await normalizeBranding(body);

    await prisma.auditLog.create({
      data: {
        action: "branding_updated",
        entityType: "branding",
        entityId: "global",
        meta: normalized,
      },
    });

    return NextResponse.json({
      message: "Branding saved successfully",
      branding: normalized,
    });
  } catch (error) {
    console.error("POST BRANDING ERROR:", error);
    return NextResponse.json(
      {
        message:
          "Something went wrong. We could not complete your request right now. Please try again.",
      },
      { status: 500 }
    );
  }
}