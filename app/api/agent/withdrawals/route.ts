import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ message: "agentId is required" }, { status: 400 });

    const withdrawals = readJsonArray<any>(dataPath("withdrawals.json"))
      .filter((item) => String(item.agentId) === String(agentId))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return NextResponse.json({ withdrawals });
  } catch (error) {
    console.error("AGENT WITHDRAWALS GET ERROR:", error);
    return NextResponse.json({ message: "Server error", withdrawals: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { withdrawalId, action, note } = await req.json();
    if (!withdrawalId || !["approve", "reject"].includes(action)) {
      return NextResponse.json({ message: "withdrawalId and valid action are required" }, { status: 400 });
    }

    const path = dataPath("withdrawals.json");
    const withdrawals = readJsonArray<any>(path);
    const users = readJsonArray<any>(dataPath("users.json"));

    const index = withdrawals.findIndex((item) => item.id === withdrawalId);
    if (index === -1) return NextResponse.json({ message: "Withdrawal request not found" }, { status: 404 });
    if (withdrawals[index].status !== "pending") return NextResponse.json({ message: "This request can no longer be reviewed by the agent" }, { status: 400 });

    withdrawals[index] = {
      ...withdrawals[index],
      status: action === "approve" ? "agent_approved" : "rejected",
      agent_note: String(note || "").trim(),
      updated_at: nowIso(),
      agent_reviewed_at: nowIso(),
    };

    writeJsonArray(path, withdrawals);

    const playerUser = users.find((item) => String(item.email) === String(withdrawals[index].playerEmail));

    if (action === "approve") {
      createNotification({
        targetRole: "admin",
        targetId: "admin-1",
        title: "Payout approved by agent",
        message: `The winning payout for ${withdrawals[index].playerEmail} is now ready for admin transfer.`,
      });
      if (playerUser?.id) {
        createNotification({
          targetRole: "player",
          targetId: playerUser.id,
          title: "Your payout was approved by the agent",
          message: "Admin is now waiting to send your winning funds.",
        });
      }
    } else if (playerUser?.id) {
      createNotification({
        targetRole: "player",
        targetId: playerUser.id,
        title: "Payout request rejected",
        message: "Your payout request was rejected by the agent. Please verify your submitted details and try again.",
      });
    }

    return NextResponse.json({ message: action === "approve" ? "Withdrawal approved by agent" : "Withdrawal rejected", withdrawal: withdrawals[index] });
  } catch (error) {
    console.error("AGENT WITHDRAWALS POST ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
