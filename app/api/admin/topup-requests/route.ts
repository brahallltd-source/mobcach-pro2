import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const prisma = getPrisma();
    const requests = await prisma?.rechargeRequest.findMany({
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ requests: requests || [] });
  } catch (error) {
    return NextResponse.json({ requests: [] });
  }
}

// 🟢 هاد الـ POST هو اللي غايخلي أزرار Approve و Reject يخدمو
export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { requestId, action } = await req.json();

    if (!requestId || !action) {
      return NextResponse.json({ success: false, message: "Missing data" }, { status: 400 });
    }

    const newStatus = action === "approve" ? "approved" : "rejected";

    const updatedRequest = await prisma?.rechargeRequest.update({
      where: { id: String(requestId) },
      data: { 
        status: newStatus,
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error("ADMIN ACTION ERROR:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}