import { NextResponse } from "next/server";
import { dataPath, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { playerId } = await req.json();
    if (!playerId) return NextResponse.json({ message: "playerId is required" }, { status: 400 });
    const playersPath = dataPath("players.json");
    const usersPath = dataPath("users.json");
    const ordersPath = dataPath("orders.json");
    const complaintsPath = dataPath("complaints.json");
    const players = readJsonArray<any>(playersPath);
    const users = readJsonArray<any>(usersPath);
    const orders = readJsonArray<any>(ordersPath);
    const complaints = readJsonArray<any>(complaintsPath);
    const player = players.find((item) => item.id === playerId);
    if (!player) return NextResponse.json({ message: "Player not found" }, { status: 404 });
    const nextPlayers = players.filter((item) => item.id !== playerId);
    const nextUsers = users.filter((item) => item.id !== player.user_id);
    const email = users.find((item) => item.id === player.user_id)?.email || "";
    const nextOrders = orders.filter((item) => item.playerEmail !== email);
    const nextComplaints = complaints.filter((item) => item.playerEmail !== email);
    writeJsonArray(playersPath, nextPlayers);
    writeJsonArray(usersPath, nextUsers);
    writeJsonArray(ordersPath, nextOrders);
    writeJsonArray(complaintsPath, nextComplaints);
    return NextResponse.json({ message: "Player deleted successfully" });
  } catch (error) {
    console.error("DELETE PLAYER ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
