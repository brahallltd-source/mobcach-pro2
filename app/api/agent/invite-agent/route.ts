
import { NextResponse } from "next/server";
import { creditWallet } from "@/lib/wallet";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, normalize, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ message: "agentId is required", invites: [] }, { status: 400 });
    const invites = readJsonArray<any>(dataPath("agent_agent_invites.json")).filter((item) => String(item.referrer_agent_id) === String(agentId));
    return NextResponse.json({ invites });
  } catch (error) {
    console.error("GET INVITE AGENT ERROR:", error);
    return NextResponse.json({ message: "Server error", invites: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { agentId, type, invitedAgentEmail } = body;
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });

    const invitesPath = dataPath("agent_agent_invites.json");
    const usersPath = dataPath("users.json");
    const invites = readJsonArray<any>(invitesPath);
    const users = readJsonArray<any>(usersPath);
    const referrer = users.find((item) => item.role === "agent" && String(item.agentId) === String(agentId));

    if (type === "generate") {
      const code = `AG-${String(agentId).slice(-6)}-${Date.now().toString().slice(-4)}`;
      const record = {
        id: uid("agent-agent-invite"),
        referrer_agent_id: String(agentId),
        invited_agent_email: String(invitedAgentEmail || ""),
        invite_code: code,
        total_recharge_amount: 0,
        bonus_awarded: false,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      invites.unshift(record);
      writeJsonArray(invitesPath, invites);
      return NextResponse.json({
        message: "Invite code generated successfully",
        invite: record,
        inviteLink: `/apply/agent?ref=${encodeURIComponent(code)}`,
      });
    }

    const related = invites.filter((item) => String(item.referrer_agent_id) === String(agentId));
    const totalRechargeAmount = related.reduce((sum, item) => sum + Number(item.total_recharge_amount || 0), 0);
    const invitedAgentsCount = related.length;
    if (related.some((item) => item.bonus_awarded)) return NextResponse.json({ message: "Agent referral bonus already awarded" }, { status: 400 });
    if (!(invitedAgentsCount >= 5 || totalRechargeAmount >= 5000)) return NextResponse.json({ message: "Threshold not reached yet" }, { status: 400 });
    creditWallet(agentId, 500, "invite_agent_bonus", { invitedAgentsCount, totalRechargeAmount, targetAmount: 5000, targetAgents: 5 });
    const updated = invites.map((item) => String(item.referrer_agent_id) === String(agentId) ? { ...item, bonus_awarded: true, updated_at: nowIso() } : item);
    writeJsonArray(invitesPath, updated);
    createNotification({ targetRole: "agent", targetId: String(agentId), title: "Agent invite bonus awarded", message: "You received 500 DH for inviting agents." });
    return NextResponse.json({ message: "Agent invite bonus awarded successfully", summary: { agentId, invitedAgentsCount, totalRechargeAmount, bonusAmount: 500 } });
  } catch (error) {
    console.error("POST INVITE AGENT ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
