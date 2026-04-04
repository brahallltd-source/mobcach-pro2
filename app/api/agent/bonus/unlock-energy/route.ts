
import { NextResponse } from "next/server";
import { unlockEnergyReward } from "@/lib/bonus";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { agentId } = await req.json();
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    const result = unlockEnergyReward(String(agentId));
    return NextResponse.json({ message: "Energy reward moved to pending bonus", result });
  } catch (error: any) {
    console.error("UNLOCK ENERGY REWARD ERROR:", error);
    return NextResponse.json({ message: error.message || "Server error" }, { status: 400 });
  }
}
