
import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const rows = readJsonArray<any>(dataPath("winner_requests.json")).filter((item) => !agentId || String(item.agentId) === String(agentId));
    return NextResponse.json({ requests: rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) });
  } catch (error) {
    console.error("GET WINNER REQUESTS ERROR:", error);
    return NextResponse.json({ message: "Server error", requests: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { playerEmail, agentId, amount, note } = await req.json();
    if (!playerEmail || !agentId || !amount) return NextResponse.json({ message: "playerEmail, agentId and amount are required" }, { status: 400 });
    const path = dataPath("winner_requests.json");
    const rows = readJsonArray<any>(path);
    const record = { id: uid("winner-req"), playerEmail: String(playerEmail), agentId: String(agentId), amount: Number(amount), note: String(note || ""), status: "pending", created_at: nowIso(), updated_at: nowIso() };
    rows.unshift(record);
    writeJsonArray(path, rows);
    createNotification({ targetRole: "agent", targetId: String(agentId), title: "Winner confirmation request", message: `Player ${playerEmail} submitted a winner confirmation request for ${amount} DH.` });
    createNotification({ targetRole: "admin", targetId: "admin-1", title: "Winner request pending", message: `A winner confirmation request is waiting for review.` });
    return NextResponse.json({ message: "Winner confirmation request submitted ✅", request: record });
  } catch (error) {
    console.error("POST WINNER REQUESTS ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
