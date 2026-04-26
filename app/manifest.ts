import type { MetadataRoute } from "next";
import { getPrisma } from "@/lib/db";
import { getOrCreateSystemSettings } from "@/lib/system-settings";
import { DEFAULT_PRIMARY, normalizeHexColor } from "@/lib/get-public-branding-merged";

export const dynamic = "force-dynamic";

const DEFAULT_BG = "#0f172a";
const FALLBACK_ICON_192 = "/icon-192x192.png";
const FALLBACK_ICON_512 = "/icon-512x512.png";

/**
 * Web App Manifest — values from `SystemSettings` (admin branding).
 * Name/short_name are fixed per product spec; icons and colors fall back when unset.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let themeColor = DEFAULT_PRIMARY;
  let backgroundColor = DEFAULT_BG;
  let pwaIcon192: string | null = null;
  let pwaIcon512: string | null = null;

  const prisma = getPrisma();
  if (prisma) {
    try {
      const sys = await getOrCreateSystemSettings(prisma);
      themeColor = normalizeHexColor(String(sys.pwaThemeColor ?? ""), DEFAULT_PRIMARY);
      backgroundColor = normalizeHexColor(String(sys.pwaBgColor ?? ""), DEFAULT_BG);
      pwaIcon192 = sys.pwaIcon192;
      pwaIcon512 = sys.pwaIcon512;
    } catch {
      // use fallbacks below
    }
  }

  const icon192 = String(pwaIcon192 ?? "").trim() || FALLBACK_ICON_192;
  const icon512 = String(pwaIcon512 ?? "").trim() || FALLBACK_ICON_512;

  return {
    name: "GS365",
    short_name: "GS365",
    description: "Modern recharge workflow for players, agents and admins",
    start_url: "/",
    display: "standalone",
    background_color: backgroundColor,
    theme_color: themeColor,
    orientation: "portrait-primary",
    icons: [
      { src: icon192, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon512, sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
