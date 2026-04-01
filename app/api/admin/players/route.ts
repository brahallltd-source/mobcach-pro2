import { NextResponse } from "next/server";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  try {
    const users = readJsonArray<any>(dataPath("users.json"));
    const players = readJsonArray<any>(dataPath("players.json"));
    const rows = players.map((player) => {
      const user = users.find((item) => item.id === player.user_id) || null;
      return {
        id: player.id,
        user_id: player.user_id,
        email: user?.email || "",
        first_name: player.first_name || "",
        last_name: player.last_name || "",
        status: player.status || "inactive",
        assigned_agent_id: player.assigned_agent_id || "",
        created_at: player.created_at || user?.created_at || "",
        frozen: Boolean(player.frozen || user?.frozen),
      };
    });
    return NextResponse.json({ players: rows });
  } catch (error) {
    console.error("ADMIN PLAYERS ERROR:", error);
    return NextResponse.json({ message: "Server error", players: [] }, { status: 500 });
  }
}
