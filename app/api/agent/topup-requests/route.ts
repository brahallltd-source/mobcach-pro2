
import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    if (!agentId) return NextResponse.json({ message: "agentId is required", requests: [] }, { status: 400 });
    const requests = readJsonArray<any>(dataPath("agent_topup_requests.json")).filter((item) => String(item.agentId) === String(agentId));
    return NextResponse.json({ requests });
  } catch (error) {
    console.error("GET AGENT TOPUP REQUESTS ERROR:", error);
    return NextResponse.json({ message: "Server error", requests: [] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { agentId, agentEmail, amount, admin_method_id, admin_method_name, tx_hash, proof_url, proof_hash, note } = await req.json();
    if (!agentId || !agentEmail || !amount || !admin_method_id || !admin_method_name) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 });
    }
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount < 1000) {
      return NextResponse.json({ message: "Minimum recharge request is 1000 DH" }, { status: 400 });
    }
    const path = dataPath("agent_topup_requests.json");
    const requests = readJsonArray<any>(path);
    const record = {
      id: uid("topupreq"),
      agentId: String(agentId),
      agentEmail: String(agentEmail),
      amount: numericAmount,
      admin_method_id: String(admin_method_id),
      admin_method_name: String(admin_method_name),
      tx_hash: String(tx_hash || ""),
      proof_url: String(proof_url || ""),
      proof_hash: String(proof_hash || ""),
      note: String(note || ""),
      status: "pending",
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    requests.unshift(record);
    writeJsonArray(path, requests);
    createNotification({ targetRole: "admin", targetId: "admin", title: "Agent wallet recharge request", message: `${agentEmail} requested ${numericAmount} DH wallet top-up.` });
    return NextResponse.json({ message: "Recharge request sent to admin", request: record });
  } catch (error) {
    console.error("CREATE AGENT TOPUP REQUEST ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
