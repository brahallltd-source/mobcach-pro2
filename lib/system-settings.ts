import type { PrismaClient } from "@prisma/client";
import { BRANDING } from "@/lib/branding";

export const SYSTEM_SETTINGS_ROW_ID = "default";

export async function getOrCreateSystemSettings(prisma: PrismaClient) {
  const existing = await prisma.systemSettings.findUnique({
    where: { id: SYSTEM_SETTINGS_ROW_ID },
  });
  if (existing) return existing;
  return prisma.systemSettings.create({
    data: {
      id: SYSTEM_SETTINGS_ROW_ID,
      bonusPercentage: 10,
      minRechargeAmount: 1000,
      affiliateBonusEnabled: true,
      maxWithdrawalAmount: 100000,
      isMaintenance: false,
      platformName: BRANDING.name,
      primaryColor: "#0f172a",
    },
  });
}
