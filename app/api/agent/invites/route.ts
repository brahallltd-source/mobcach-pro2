import { NextResponse } from "next/server";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const invites = readJsonArray<any>(dataPath("agent_invites.json"));
  return NextResponse.json({ invites: invites.filter((item) => !agentId || String(item.agentId) === String(agentId)) });
}
