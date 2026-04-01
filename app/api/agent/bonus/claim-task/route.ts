
import { NextResponse } from "next/server";
import { claimTaskReward } from "@/lib/bonus";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    const task = claimTaskReward(String(agentId));
    return NextResponse.json({ message: "Task reward moved to pending bonus", task });
  } catch (error: any) {
    console.error("CLAIM TASK REWARD ERROR:", error);
    return NextResponse.json({ message: error.message || "Server error" }, { status: 400 });
  }
}
