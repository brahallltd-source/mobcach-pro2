import { NextResponse } from "next/server";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    const agentsPath = dataPath("agents.json");
    const usersPath = dataPath("users.json");
    const agents = readJsonArray<any>(agentsPath);
    const users = readJsonArray<any>(usersPath);
    const index = agents.findIndex((item) => String(item.id) === String(agentId));
    if (index === -1) return NextResponse.json({ message: "Agent not found" }, { status: 404 });
    const nextFrozen = !Boolean(agents[index].frozen);
    agents[index] = { ...agents[index], frozen: nextFrozen, status: nextFrozen ? "frozen" : (agents[index].status === "frozen" ? "account_created" : agents[index].status), updated_at: nowIso() };
    const userIndex = users.findIndex((item) => String(item.agentId || "") === String(agentId));
    if (userIndex !== -1) users[userIndex] = { ...users[userIndex], frozen: nextFrozen };
    writeJsonArray(agentsPath, agents);
    writeJsonArray(usersPath, users);
    return NextResponse.json({ message: nextFrozen ? "Agent frozen" : "Agent unfrozen", agent: agents[index] });
  } catch (error) {
    console.error("TOGGLE AGENT FREEZE ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again." }, { status: 500 });
  }
}
