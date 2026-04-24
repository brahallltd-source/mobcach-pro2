import { cache } from "react";
import { getPrisma } from "@/lib/db";
import { getOrCreateSystemSettings } from "@/lib/system-settings";
import { BRANDING } from "@/lib/branding";

const DEFAULT_PRIMARY = "#0f172a";
const DEFAULT_PLATFORM = BRANDING.name;

export type RootBranding = {
  platformName: string;
  primaryColor: string;
  faviconUrl: string | null;
};

export const getRootBranding = cache(async (): Promise<RootBranding> => {
  const prisma = getPrisma();
  if (!prisma) {
    return {
      platformName: DEFAULT_PLATFORM,
      primaryColor: DEFAULT_PRIMARY,
      faviconUrl: null,
    };
  }
  const s = await getOrCreateSystemSettings(prisma);
  const primary = String(s.primaryColor || "").trim();
  return {
    platformName: s.platformName?.trim() || DEFAULT_PLATFORM,
    primaryColor: /^#[0-9A-Fa-f]{3,8}$/.test(primary) ? primary : DEFAULT_PRIMARY,
    faviconUrl: s.faviconUrl?.trim() ? s.faviconUrl.trim() : null,
  };
});
