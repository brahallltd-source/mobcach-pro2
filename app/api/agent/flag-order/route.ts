import { NextResponse } from "next/server";
import { createNotification } from "@/lib/notifications";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { orderId, reason } = await req.json();
    if (!orderId) return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    const ordersPath = dataPath("orders.json");
    const disputesPath = dataPath("disputes.json");
    const orders = readJsonArray<any>(ordersPath);
    const disputes = readJsonArray<any>(disputesPath);
    const index = orders.findIndex((item) => item.id === orderId);
    if (index === -1) return NextResponse.json({ message: "Order not found" }, { status: 404 });
    const order = orders[index];
    orders[index] = { ...order, review_required: true, review_reason: reason || "Manual review requested", status: "flagged_for_review", updated_at: nowIso() };
    disputes.unshift({ id: uid("dispute"), orderId: order.id, playerEmail: order.playerEmail, agentId: order.agentId, reason: reason || "Manual review requested", status: "open", admin_note: "", created_at: nowIso(), updated_at: nowIso() });
    writeJsonArray(ordersPath, orders);
    writeJsonArray(disputesPath, disputes);
    createNotification({ targetRole: "admin", targetId: "admin", title: "Order flagged", message: `Order ${order.id} was flagged for review.` });
    return NextResponse.json({ message: "Order flagged for review ✅", order: orders[index] });
  } catch (error) {
    console.error("FLAG ORDER ERROR:", error);
    return NextResponse.json({ message: `Something went wrong
We could not complete your request right now. Please try again.`, }, { status: 500 });
  }
}
