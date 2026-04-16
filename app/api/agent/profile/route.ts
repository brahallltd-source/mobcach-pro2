import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();

    if (!agentId) return NextResponse.json({ status: "ERROR", message: "Missing ID" }, { status: 400 });

    // 🟢 البحث الشامل: كنقلبو فـ جدول Agent بالـ ID ديالو أو بالـ userId
    let agent = await prisma.agent.findFirst({
      where: {
        OR: [
          { id: agentId },
          { userId: agentId }
        ]
      },
      select: { status: true, username: true, id: true }
    });

    // 🟠 إلا مالقيناش Agent، واش هاد اليوزر أصلاً كاين فـ جدول User؟
    if (!agent) {
      const user = await prisma.user.findUnique({
        where: { id: agentId },
        select: { status: true, username: true, role: true }
      });

      if (user && user.role === "AGENT") {
        return NextResponse.json({ 
          status: user.status || "PENDING", 
          username: user.username 
        });
      }
      
      return NextResponse.json({ status: "NOT_FOUND" }, { status: 404 });
    }

    return NextResponse.json({ 
      status: agent.status, 
      username: agent.username,
      realAgentId: agent.id 
    });

  } catch (error) {
    return NextResponse.json({ status: "ERROR" }, { status: 500 });
  }
}