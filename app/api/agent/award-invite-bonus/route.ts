import { NextResponse } from "next/server";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    const invitesPath = dataPath("agent_invites.json");
    const invites = readJsonArray<any>(invitesPath);
    const related = invites.filter((item) => String(item.agentId) === String(agentId));
    const totalRechargeAmount = related.reduce((sum, item) => sum + Number(item.total_recharge_amount || 0), 0);
    if (totalRechargeAmount < 3000) return NextResponse.json({ message: "Invite bonus threshold of 3000 DH not reached yet" }, { status: 400 });
    if (related.some((item) => item.bonus_awarded)) return NextResponse.json({ message: "Invite bonus already awarded" }, { status: 400 });
    creditWallet(agentId, 200, "invite_bonus", { targetAmount: 3000 });
    const updated = invites.map((item) => String(item.agentId) === String(agentId) ? { ...item, bonus_awarded: true, updated_at: nowIso() } : item);
    writeJsonArray(invitesPath, updated);
    createNotification({ targetRole: "agent", targetId: String(agentId), title: "Player invite bonus awarded", message: "You received 200 DH player invite bonus." });
    return NextResponse.json({ message: "Player invite bonus awarded successfully ✅", summary: { agentId, totalRechargeAmount, bonusAmount: 200 } });
  } catch (error) {
    console.error("AWARD INVITE BONUS ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
