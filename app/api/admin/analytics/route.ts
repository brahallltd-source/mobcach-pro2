
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireAdminPermission("overview");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const orders = readJsonArray<any>(dataPath("orders.json"));
    const users = readJsonArray<any>(dataPath("users.json"));
    const agents = readJsonArray<any>(dataPath("agents.json"));
    const players = readJsonArray<any>(dataPath("players.json"));
    const withdrawals = readJsonArray<any>(dataPath("withdrawals.json"));
    const complaints = readJsonArray<any>(dataPath("complaints.json"));
    const topups = readJsonArray<any>(dataPath("agent_topup_requests.json"));
    const referrals = readJsonArray<any>(dataPath("referrals.json"));
    const proofHashes = readJsonArray<any>(dataPath("proof_hashes.json"));

    const totalOrderVolume = orders.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const completedOrderVolume = orders.filter((item) => item.status === "completed").reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const growth = {
      users: users.length,
      players: players.length,
      agents: agents.filter((item) => item.status === "account_created").length,
      pendingAgents: agents.filter((item) => item.status === "pending_agent_review").length,
      referrals: referrals.length,
    };

    const finance = {
      orders: orders.length,
      orderVolume: totalOrderVolume,
      completedOrderVolume,
      withdrawalsPending: withdrawals.filter((item) => item.status === "pending" || item.status === "agent_approved").length,
      topupsPending: topups.filter((item) => item.status === "pending").length,
    };

    const trust = {
      complaints: complaints.length,
      duplicateProofs: proofHashes.filter((item) => Number(item.duplicate_count || 0) > 1).length,
      flaggedOrders: orders.filter((item) => item.review_required || item.status === "flagged_for_review").length,
      completedOrders: orders.filter((item) => item.status === "completed").length,
    };

    const orderStatusChart = [
      { name: "Pending", value: orders.filter((item) => item.status === "pending_payment").length },
      { name: "Proof", value: orders.filter((item) => item.status === "proof_uploaded").length },
      { name: "Review", value: orders.filter((item) => item.status === "flagged_for_review").length },
      { name: "Approved", value: orders.filter((item) => item.status === "agent_approved_waiting_player").length },
      { name: "Completed", value: orders.filter((item) => item.status === "completed").length },
    ];

    return NextResponse.json({ growth, finance, trust, orderStatusChart });
  } catch (error) {
    console.error("ADMIN ANALYTICS ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again." }, { status: 500 });
  }
}
