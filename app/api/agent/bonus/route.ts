
import { NextResponse } from "next/server";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    const profiles = readJsonArray<any>(dataPath("agent_bonus_profiles.json"));
    const profile = profiles.find((item) => String(item.agentId) === String(agentId)) || { agentId, volume: 0, energy: 0, completedOrders: 0, pendingBonus: 0 };
    return NextResponse.json({ profile });
  } catch (error) {
    console.error("GET AGENT BONUS ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
