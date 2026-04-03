import { NextResponse } from "next/server";
import { dataPath, readJsonArray, writeJsonArray } from "@/lib/json";
import { EXECUTION_TIME_OPTIONS } from "@/lib/payment-options";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ message: "agentId is required", agent: null, profile: null }, { status: 400 });
    const agent = readJsonArray<any>(dataPath("agents.json")).find((item) => String(item.id) === String(agentId)) || null;
    const profile = readJsonArray<any>(dataPath("agent_profiles.json")).find((item) => String(item.agentId) === String(agentId)) || null;
    return NextResponse.json({ agent, profile });
  } catch (error) {
    console.error("GET AGENT SETTINGS ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again.", agent: null, profile: null }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { agentId, email, phone, response_minutes } = await req.json();
    if (!agentId || !email || !phone || !response_minutes) return NextResponse.json({ message: "agentId, email, phone and response_minutes are required" }, { status: 400 });
    const minutes = Number(response_minutes);
    if (!EXECUTION_TIME_OPTIONS.includes(minutes)) return NextResponse.json({ message: "Invalid execution time" }, { status: 400 });
    const agentsPath = dataPath("agents.json");
    const profilesPath = dataPath("agent_profiles.json");
    const usersPath = dataPath("users.json");
    const agents = readJsonArray<any>(agentsPath);
    const profiles = readJsonArray<any>(profilesPath);
    const users = readJsonArray<any>(usersPath);
    const agentIndex = agents.findIndex((item) => String(item.id) === String(agentId));
    if (agentIndex === -1) return NextResponse.json({ message: "Agent not found" }, { status: 404 });
    const duplicateEmail = agents.find((item, index) => index !== agentIndex && String(item.email || "").toLowerCase() === String(email).toLowerCase());
    if (duplicateEmail) return NextResponse.json({ message: "Email already used by another agent" }, { status: 400 });
    agents[agentIndex] = { ...agents[agentIndex], email: String(email).trim(), phone: String(phone).trim(), updated_at: new Date().toISOString() };
    const profileIndex = profiles.findIndex((item) => String(item.agentId) === String(agentId));
    if (profileIndex !== -1) profiles[profileIndex] = { ...profiles[profileIndex], response_minutes: minutes };
    const userIndex = users.findIndex((item) => String(item.agentId) === String(agentId));
    if (userIndex !== -1) users[userIndex] = { ...users[userIndex], email: String(email).trim() };
    writeJsonArray(agentsPath, agents);
    writeJsonArray(profilesPath, profiles);
    writeJsonArray(usersPath, users);
    return NextResponse.json({ message: "Settings updated successfully", agent: agents[agentIndex], profile: profileIndex !== -1 ? profiles[profileIndex] : null });
  } catch (error) {
    console.error("UPDATE AGENT SETTINGS ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again." }, { status: 500 });
  }
}
