import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAgentFromMobcashUserCookie } from "@/lib/mobcash-user-cookie";
import { getOrCreateSystemSettings } from "@/lib/system-settings";

export const runtime = "nodejs";

/** Announcement, maintenance flag, and recharge bonus % for signed-in agents. */
export async function GET() {
  const agent = await getAgentFromMobcashUserCookie();
  if (!agent) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({
      announcement: "",
      isMaintenance: false,
      bonusPercentage: 10,
    });
  }

  const row = await getOrCreateSystemSettings(prisma);
  return NextResponse.json({
    announcement: String(row.announcement ?? "").trim(),
    isMaintenance: Boolean(row.isMaintenance),
    bonusPercentage: Number(row.bonusPercentage),
  });
}
