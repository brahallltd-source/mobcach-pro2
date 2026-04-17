import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ success: false }, { status: 500 });

    const body = await req.json();
    const { 
      agentId, 
      agentEmail, 
      amount, 
      adminMethodId, 
      adminMethodName, 
      proofUrl, // يجب أن يتطابق مع المرسل من الصفحة
      note 
    } = body;
    
    const request = await prisma.rechargeRequest.create({
      data: {
        id: crypto.randomUUID(),
        agentId: String(agentId),
        agentEmail: String(agentEmail),
        amount: parseFloat(amount),
        adminMethodId: String(adminMethodId),
        adminMethodName: String(adminMethodName),
        proofUrl: proofUrl || "", // سيُحفظ الرابط هنا الآن
        status: "pending",
        updatedAt: new Date()
      }
    });

    return NextResponse.json({ success: true, request });
  } catch (error: any) {
    console.error("TOPUP API ERROR:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const agentId = searchParams.get("agentId");
  const prisma = getPrisma();

  try {
    const requests = await prisma?.rechargeRequest.findMany({
      where: agentId ? { agentId: String(agentId) } : {},
      orderBy: { createdAt: "desc" }
    });
    return NextResponse.json({ requests });
  } catch (e) {
    return NextResponse.json({ requests: [] });
  }
}