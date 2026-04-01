
import { NextResponse } from "next/server";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function GET() {
  try {
    const methods = readJsonArray<any>(dataPath("admin_payment_methods.json")).filter((item) => item.active !== false);
    return NextResponse.json({ methods });
  } catch (error) {
    console.error("PUBLIC ADMIN PAYMENT METHODS GET ERROR:", error);
    return NextResponse.json({ message: "Server error", methods: [] }, { status: 500 });
  }
}
