import type { BrandingSettings, PrismaClient } from "@prisma/client";

const SINGLETON_ID = 1;

export async function getOrCreateBrandingSettings(prisma: PrismaClient): Promise<BrandingSettings> {
  const existing = await prisma.brandingSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (existing) return existing;
  return prisma.brandingSettings.create({
    data: { id: SINGLETON_ID },
  });
}

export function brandingSettingsPublicPayload(row: BrandingSettings) {
  return {
    facebook: row.facebook,
    instagram: row.instagram,
    telegram: row.telegram,
    gmail: row.gmail,
    websiteUrl: row.websiteUrl,
    showFb: row.showFb,
    showInsta: row.showInsta,
    showTele: row.showTele,
  };
}
