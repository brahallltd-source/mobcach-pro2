import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");

    if (!agentId) return NextResponse.json({ message: "Agent ID required" }, { status: 400 });

    // البحث عن الوكيل في قاعدة البيانات
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        fullName: true,
        phone: true,
        // تأكد أن هذا الحقل هو المسؤول عن الرصيد المتاح للوكيل
        availableBalance: true, 
      }
    });

    if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

    return NextResponse.json({ agent });
  } catch (error) {
    return NextResponse.json({ message: "Internal Error" }, { status: 500 });
  }
}