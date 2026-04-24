import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { brandingSettingsPublicPayload, getOrCreateBrandingSettings } from "@/lib/branding-settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public contact / social links for player footer (no auth). */
export async function GET() {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({
        branding: {
          facebook: null,
          instagram: null,
          telegram: null,
          gmail: null,
          websiteUrl: "https://gosport365.com",
          showFb: true,
          showInsta: true,
          showTele: true,
        },
      });
    }
    const row = await getOrCreateBrandingSettings(prisma);
    return NextResponse.json({ branding: brandingSettingsPublicPayload(row) });
  } catch (e) {
    console.error("GET /api/branding", e);
    return NextResponse.json({ branding: null }, { status: 500 });
  }
}
