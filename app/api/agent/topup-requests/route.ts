import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const data = await req.json();

    // التحقق من الحقول الإلزامية في السكيما
    if (!data.agentId || !data.agentEmail || !data.amount) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 });
    }

    const request = await prisma.rechargeRequest.create({
      data: {
        id: uuidv4(), // ضروري لأن السكيما لا تملك @default(uuid)
        agentId: String(data.agentId),
        agentEmail: String(data.agentEmail),
        amount: parseFloat(data.amount),
        adminMethodId: String(data.admin_method_id),
        adminMethodName: String(data.admin_method_name || "Bank Transfer"),
        proofUrl: data.proof_url || "",
        note: data.note || "",
        status: "pending",
        updatedAt: new Date(), // ضروري لأن السكيما لا تملك @updatedAt
      }
    });

    return NextResponse.json({ success: true, request });
  } catch (error: any) {
    console.error("AGENT RECHARGE API ERROR:", error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();
    
    const requests = await prisma.rechargeRequest.findMany({
        where: { agentId: String(agentId) },
        orderBy: { createdAt: "desc" }
    });
    
    return NextResponse.json({ requests });
}