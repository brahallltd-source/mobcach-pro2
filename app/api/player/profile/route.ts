import { NextResponse } from "next/server";
import { dataPath, normalize, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email");
    if (!email) return NextResponse.json({ message: "Email is required", profile: null }, { status: 400 });
    const users = readJsonArray<any>(dataPath("users.json"));
    const players = readJsonArray<any>(dataPath("players.json"));
    const user = users.find((u) => normalize(u.email) === normalize(email) && u.role === "player");
    if (!user) return NextResponse.json({ message: "Player user not found", profile: null }, { status: 404 });
    const player = players.find((p) => p.user_id === user.id);
    if (!player) return NextResponse.json({ message: "Player profile not found", profile: null }, { status: 404 });
    return NextResponse.json({ profile: { user_id: user.id, email: user.email, ...player } });
  } catch (error) {
    console.error("GET PLAYER PROFILE ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again.", profile: null }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { currentEmail, newEmail, newPhone } = await req.json();
    if (!currentEmail || !newEmail || !newPhone) return NextResponse.json({ message: "currentEmail, newEmail and newPhone are required" }, { status: 400 });
    const usersPath = dataPath("users.json");
    const playersPath = dataPath("players.json");
    const users = readJsonArray<any>(usersPath);
    const players = readJsonArray<any>(playersPath);
    const userIndex = users.findIndex((u) => normalize(u.email) === normalize(currentEmail) && u.role === "player");
    if (userIndex === -1) return NextResponse.json({ message: "Player user not found" }, { status: 404 });
    const user = users[userIndex];
    const playerIndex = players.findIndex((p) => p.user_id === user.id);
    if (playerIndex === -1) return NextResponse.json({ message: "Player profile not found" }, { status: 404 });
    const emailTaken = users.find((u) => normalize(u.email) === normalize(newEmail) && u.id !== user.id);
    if (emailTaken) return NextResponse.json({ message: "This email is already used by another account" }, { status: 400 });
    users[userIndex] = { ...users[userIndex], email: String(newEmail).trim() };
    players[playerIndex] = { ...players[playerIndex], phone: String(newPhone).trim() };
    writeJsonArray(usersPath, users); writeJsonArray(playersPath, players);
    return NextResponse.json({ message: "Profile updated successfully ✅", user: { id: users[userIndex].id, email: users[userIndex].email, role: users[userIndex].role, player_status: players[playerIndex].status || "inactive", assigned_agent_id: players[playerIndex].assigned_agent_id || "" }, profile: { email: users[userIndex].email, phone: players[playerIndex].phone } });
  } catch (error) {
    console.error("UPDATE PLAYER PROFILE ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again." }, { status: 500 });
  }
}
