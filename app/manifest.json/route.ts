import { NextResponse } from "next/server";
import { getPublicBrandingMerged } from "@/lib/get-public-branding-merged";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Web app manifest; icons and theme come from `SystemSettings` (admin branding). */
export async function GET() {
  const b = await getPublicBrandingMerged();
  const name = String(b.platformName || b.brandName || "App").trim() || "App";
  const short = name.length > 16 ? `${name.slice(0, 15)}…` : name;
  const theme = String(b.primaryColor || "#0f172a").trim();

  const icons: Array<{ src: string; sizes: string; type: string; purpose?: string }> = [];
  const i192 = String(b.pwaIcon192 ?? "").trim();
  const i512 = String(b.pwaIcon512 ?? "").trim();
  if (i192) {
    icons.push({ src: i192, sizes: "192x192", type: "image/png", purpose: "any" });
  }
  if (i512) {
    icons.push({ src: i512, sizes: "512x512", type: "image/png", purpose: "any" });
  }

  const manifest = {
    name,
    short_name: short,
    description: "Modern recharge workflow for players, agents and admins",
    start_url: "/",
    display: "standalone",
    background_color: theme,
    theme_color: theme,
    orientation: "portrait-primary" as const,
    icons,
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
