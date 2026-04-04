
import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { creditWallet } from "@/lib/wallet";
import { applyPendingBonusesToRecharge } from "@/lib/bonus";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const requests = readJsonArray<any>(dataPath("agent_topup_requests.json"));
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("GET ADMIN TOPUP REQUESTS ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`,, requests: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });

  try {
    const { requestId, action, adminEmail, transfer_reference, admin_note } = await req.json();
    if (!requestId || !action) return NextResponse.json({ message: "requestId and action are required" }, { status: 400 });

    const path = dataPath("agent_topup_requests.json");
    const requests = readJsonArray<any>(path);
    const index = requests.findIndex((item) => item.id === requestId);
    if (index === -1) return NextResponse.json({ message: "Request not found" }, { status: 404 });

    const requestRow = requests[index];
    if (requestRow.status !== "pending") return NextResponse.json({ message: "Request already processed" }, { status: 400 });

    if (action === "approve") {
      const baseAmount = Number(requestRow.amount);
      const bonusAmount = Math.floor(baseAmount * 0.1);
      creditWallet(requestRow.agentId, baseAmount, "agent_self_topup", { adminEmail, requestId, transfer_reference });
      if (bonusAmount > 0) {
        creditWallet(requestRow.agentId, bonusAmount, "agent_self_topup_bonus", { adminEmail, requestId, baseAmount, transfer_reference });
      }
      const pendingApplied = applyPendingBonusesToRecharge(String(requestRow.agentId), adminEmail);

      requests[index] = {
        ...requestRow,
        status: "approved",
        bonus_amount: bonusAmount,
        pendingBonusApplied: pendingApplied.totalApplied,
        transfer_reference: String(transfer_reference || ""),
        admin_note: String(admin_note || ""),
        updated_at: nowIso(),
      };

      createNotification({
        targetRole: "agent",
        targetId: String(requestRow.agentId),
        title: "Recharge approved",
        message: `Your ${requestRow.amount} DH recharge was approved by admin (+${bonusAmount} DH fixed 10% bonus${pendingApplied.totalApplied ? ` + ${pendingApplied.totalApplied} DH pending bonus` : ""}).`,
      });
    } else if (action === "reject") {
      requests[index] = {
        ...requestRow,
        status: "rejected",
        transfer_reference: String(transfer_reference || ""),
        admin_note: String(admin_note || ""),
        updated_at: nowIso(),
      };
      createNotification({
        targetRole: "agent",
        targetId: String(requestRow.agentId),
        title: "Recharge rejected",
        message: `Your ${requestRow.amount} DH recharge request was rejected by admin.`,
      });
    } else {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    writeJsonArray(path, requests);
    return NextResponse.json({ message: `Request ${action}d successfully`, request: requests[index] });
  } catch (error) {
    console.error("PROCESS ADMIN TOPUP REQUEST ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
