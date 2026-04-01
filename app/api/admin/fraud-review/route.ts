import { NextResponse } from "next/server";
import { dataPath, nowIso, readJsonArray, writeJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const { orderId, action, note } = await req.json();
    if (!orderId || !action) {
      return NextResponse.json({ message: "orderId and action are required" }, { status: 400 });
    }

    const path = dataPath("orders.json");
    const orders = readJsonArray<any>(path);
    const index = orders.findIndex((item) => item.id === orderId);
    if (index === -1) {
      return NextResponse.json({ message: "Order not found" }, { status: 404 });
    }

    const order = orders[index];
    const next = { ...order, updated_at: nowIso() };

    if (action === "resolve") {
      next.review_required = false;
      next.review_reason = note || "Resolved by admin fraud center";
      next.fraud_resolution = {
        action: "resolved",
        note: note || "Resolved by admin fraud center",
        at: nowIso(),
      };
      if (next.status === "flagged_for_review") {
        next.status = "proof_uploaded";
      }
    } else if (action === "reopen") {
      next.review_required = true;
      next.status = "flagged_for_review";
      next.review_reason = note || "Reopened by admin fraud center";
      next.fraud_resolution = {
        action: "reopened",
        note: note || "Reopened by admin fraud center",
        at: nowIso(),
      };
    } else {
      return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    }

    orders[index] = next;
    writeJsonArray(path, orders);

    return NextResponse.json({
      message: action === "resolve" ? "Fraud case resolved successfully" : "Fraud case reopened successfully",
      order: next,
    });
  } catch (error) {
    console.error("ADMIN FRAUD REVIEW ERROR:", error);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
