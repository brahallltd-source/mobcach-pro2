
import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { createReferral } from "@/lib/bonus";
import { dataPath, normalize, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { email, agentCode } = await req.json();
    if (!email || !agentCode) return NextResponse.json({ message: "email and agentCode are required" }, { status: 400 });

    const usersPath = dataPath("users.json");
    const playersPath = dataPath("players.json");
    const agentsPath = dataPath("agents.json");
    const users = readJsonArray<any>(usersPath);
    const players = readJsonArray<any>(playersPath);
    const agents = readJsonArray<any>(agentsPath);

    const userIndex = users.findIndex((item) => normalize(item.email) === normalize(email) && item.role === "player");
    if (userIndex === -1) return NextResponse.json({ message: "Player not found" }, { status: 404 });
    const playerIndex = players.findIndex((item) => item.user_id === users[userIndex].id);
    if (playerIndex === -1) return NextResponse.json({ message: "Player profile not found" }, { status: 404 });
    const agent = agents.find((item) => normalize(item.referral_code || "") === normalize(agentCode) && item.status === "account_created");
    if (!agent) return NextResponse.json({ message: "Invalid agent code" }, { status: 400 });

    users[userIndex] = { ...users[userIndex], assigned_agent_id: String(agent.id) };
    players[playerIndex] = { ...players[playerIndex], assigned_agent_id: String(agent.id), updated_at: nowIso(), referred_by: String(agent.id) };
    writeJsonArray(usersPath, users);
    writeJsonArray(playersPath, players);

    createReferral({ player_user_id: users[userIndex].id, player_email: users[userIndex].email, referred_by_agent_id: String(agent.id), first_order_reward_amount: 0 });
    createNotification({ targetRole: "agent", targetId: String(agent.id), title: "Referral code used", message: `${users[userIndex].email} applied your agent code.` });

    return NextResponse.json({ message: "Referral code applied successfully", user: users[userIndex], player: players[playerIndex] });
  } catch (error) {
    console.error("APPLY REFERRAL CODE ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again." }, { status: 500 });
  }
}
