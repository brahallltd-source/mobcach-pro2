import { NextResponse } from "next/server";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const targetRole = searchParams.get("targetRole");
  const targetId = searchParams.get("targetId");
  const notifications = readJsonArray<any>(dataPath("notifications.json"));
  const filtered = notifications.filter((item) => (!targetRole || item.targetRole === targetRole) && (!targetId || String(item.targetId) === String(targetId))).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  return NextResponse.json({ notifications: filtered });
}
