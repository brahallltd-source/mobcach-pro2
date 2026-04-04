import { NextResponse } from "next/server";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { playerId } = await req.json();
    if (!playerId) return NextResponse.json({ message: "playerId is required" }, { status: 400 });
    const playersPath = dataPath("players.json");
    const usersPath = dataPath("users.json");
    const players = readJsonArray<any>(playersPath);
    const users = readJsonArray<any>(usersPath);
    const index = players.findIndex((item) => String(item.id) === String(playerId));
    if (index === -1) return NextResponse.json({ message: "Player not found" }, { status: 404 });
    const nextFrozen = !Boolean(players[index].frozen);
    players[index] = { ...players[index], frozen: nextFrozen, updated_at: nowIso() };
    const userIndex = users.findIndex((item) => item.id === players[index].user_id);
    if (userIndex !== -1) users[userIndex] = { ...users[userIndex], frozen: nextFrozen };
    writeJsonArray(playersPath, players);
    writeJsonArray(usersPath, users);
    return NextResponse.json({ message: nextFrozen ? "Player frozen" : "Player unfrozen", player: players[index] });
  } catch (error) {
    console.error("TOGGLE PLAYER FREEZE ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
