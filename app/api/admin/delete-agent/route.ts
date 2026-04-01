import { NextResponse } from "next/server";
import { dataPath, normalize, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    const agentsPath = dataPath("agents.json");
    const usersPath = dataPath("users.json");
    const playersPath = dataPath("players.json");
    const methodsPath = dataPath("agent_payment_methods.json");
    const ordersPath = dataPath("orders.json");
    const agents = readJsonArray<any>(agentsPath);
    const users = readJsonArray<any>(usersPath);
    const players = readJsonArray<any>(playersPath);
    const methods = readJsonArray<any>(methodsPath);
    const orders = readJsonArray<any>(ordersPath);
    const agent = agents.find((item) => String(item.id) === String(agentId));
    if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });
    writeJsonArray(agentsPath, agents.filter((item) => String(item.id) !== String(agentId)));
    writeJsonArray(usersPath, users.filter((item) => String(item.agentId || "") !== String(agentId) && !(normalize(item.email) === normalize(agent.email) && item.role === "agent")));
    writeJsonArray(playersPath, players.map((item) => String(item.assigned_agent_id) === String(agentId) ? { ...item, assigned_agent_id: "", status: "inactive" } : item));
    writeJsonArray(methodsPath, methods.filter((item) => String(item.agentId) !== String(agentId)));
    writeJsonArray(ordersPath, orders.map((item) => String(item.agentId) === String(agentId) && item.status !== "completed" ? { ...item, status: "flagged_for_review", review_required: true } : item));
    return NextResponse.json({ message: "Agent deleted successfully" });
  } catch (error) {
    console.error("DELETE AGENT ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
