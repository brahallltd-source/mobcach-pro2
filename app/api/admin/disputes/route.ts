import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ disputes: readJsonArray<any>(dataPath("disputes.json")) });
}

export async function POST(req: Request) {
  try {
    const { disputeId, status, admin_note } = await req.json();
    const disputesPath = dataPath("disputes.json");
    const ordersPath = dataPath("orders.json");
    const disputes = readJsonArray<any>(disputesPath);
    const orders = readJsonArray<any>(ordersPath);
    const index = disputes.findIndex((item) => item.id === disputeId);
    if (index === -1) return NextResponse.json({ message: "Dispute not found" }, { status: 404 });
    disputes[index] = { ...disputes[index], status: status || "resolved", admin_note: admin_note || "", updated_at: nowIso() };
    const orderIndex = orders.findIndex((item) => item.id === disputes[index].orderId);
    if (orderIndex !== -1 && disputes[index].status === "resolved" && orders[orderIndex].status === "flagged_for_review") {
      orders[orderIndex] = { ...orders[orderIndex], review_required: false, review_reason: "", updated_at: nowIso() };
    }
    writeJsonArray(disputesPath, disputes);
    writeJsonArray(ordersPath, orders);
    createNotification({ targetRole: "player", targetId: disputes[index].playerEmail, title: "Dispute updated", message: `Dispute for order ${disputes[index].orderId} was updated by admin.` });
    return NextResponse.json({ message: "Dispute updated successfully ✅", dispute: disputes[index] });
  } catch (error) {
    console.error("ADMIN DISPUTE ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
