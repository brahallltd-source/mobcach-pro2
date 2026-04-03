
import { NextResponse } from "next/server";
import { unlockLevelReward } from "@/lib/bonus";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { agentId, level } = await req.json();
    if (!agentId || !level) return NextResponse.json({ message: "agentId and level are required" }, { status: 400 });
    const claim = unlockLevelReward(String(agentId), Number(level));
    return NextResponse.json({ message: "Level reward moved to pending bonus", claim });
  } catch (error: any) {
    console.error("UNLOCK LEVEL REWARD ERROR:", error);
    return NextResponse.json({ message: error.message || "Something went wrong
We could not complete your request right now. Please try again." }, { status: 400 });
  }
}
