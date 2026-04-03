import { NextResponse } from "next/server";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  try {
    const orders = readJsonArray<any>(dataPath("orders.json")).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return NextResponse.json({ orders });
  } catch (error) {
    console.error("GET ADMIN ORDERS ERROR:", error);
    return NextResponse.json({ message: "Something went wrong
We could not complete your request right now. Please try again.", orders: [] }, { status: 500 });
  }
}
