import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAgentFromMobcashUserCookie } from "@/lib/mobcash-user-cookie";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { getOrCreateSystemSettings } from "@/lib/system-settings";

export const runtime = "nodejs";

async function resolveAgentUserId(): Promise<string | null> {
  const fromCookie = await getAgentFromMobcashUserCookie();
  if (fromCookie) return fromCookie.id;
  const user = await getSessionUserFromCookies();
  if (user && String(user.role).trim().toUpperCase() === "AGENT") {
    return user.id;
  }
  return null;
}

/** Announcement, maintenance, recharge bonus %, min recharge, affiliate merge, max player withdrawal cap for signed-in agents. */
export async function GET() {
  const agentUserId = await resolveAgentUserId();
  if (!agentUserId) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({
      announcement: "",
      isMaintenance: false,
      bonusPercentage: 10,
      minRechargeAmount: 1000,
      affiliateBonusEnabled: true,
      maxWithdrawalAmount: 100000,
    });
  }

  const row = await getOrCreateSystemSettings(prisma);
  const minRaw = Number(row.minRechargeAmount);
  const minRechargeAmount =
    Number.isFinite(minRaw) && minRaw >= 1 ? minRaw : 1000;

  const maxRaw = Number(row.maxWithdrawalAmount);
  const maxWithdrawalAmount =
    Number.isFinite(maxRaw) && maxRaw >= 100 ? maxRaw : 100000;

  return NextResponse.json({
    announcement: String(row.announcement ?? "").trim(),
    isMaintenance: Boolean(row.isMaintenance),
    bonusPercentage: Number(row.bonusPercentage),
    minRechargeAmount,
    affiliateBonusEnabled: Boolean(row.affiliateBonusEnabled),
    maxWithdrawalAmount,
  });
}
