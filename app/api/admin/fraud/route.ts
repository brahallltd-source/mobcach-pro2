import { NextResponse } from "next/server";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  try {
    const orders = readJsonArray<any>(dataPath("orders.json"));
    const hashes = readJsonArray<any>(dataPath("proof_hashes.json"));
    const suspiciousOrders = orders.filter((order) => order.review_required || order.status === "flagged_for_review" || (order.suspicious_flags || []).length);
    const duplicateHashes = hashes.filter((item) => Number(item.duplicate_count || 1) > 1);

    const items = suspiciousOrders.map((order) => {
      const flags = Array.isArray(order.suspicious_flags) ? order.suspicious_flags : [];
      const score = Math.min(100,
        (order.review_required ? 35 : 0) +
        (order.status === "flagged_for_review" ? 25 : 0) +
        (flags.includes("duplicate_proof_hash") ? 30 : 0) +
        (order.proof_duplicate_detected ? 10 : 0)
      );
      return {
        id: order.id,
        orderId: order.id,
        playerEmail: order.playerEmail,
        agentId: order.agentId,
        amount: order.amount,
        status: order.status,
        proof_url: order.proofUrl || "",
        proof_hash: order.proof_hash || "",
        flags,
        score,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
        review_reason: order.review_reason || "",
      };
    }).sort((a, b) => b.score - a.score || String(b.updated_at).localeCompare(String(a.updated_at)));

    return NextResponse.json({
      summary: {
        suspiciousOrders: items.length,
        duplicateHashes: duplicateHashes.length,
        pendingFlags: items.filter((item) => item.status !== "completed").length,
      },
      items,
      duplicateHashes,
    });
  } catch (error) {
    console.error("ADMIN FRAUD ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`,, summary: null, items: [], duplicateHashes: [] }, { status: 500 });
  }
}
