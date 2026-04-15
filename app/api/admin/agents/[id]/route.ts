import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requireAdminPermission } from "@/lib/server-auth";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const access = await requireAdminPermission("agents");
  if (!access.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const prisma = getPrisma();
    const { id } = params; // هادا هو الـ Agent ID
    const body = await req.json();
    const { action, amount, status } = body;

    // 1. تعديل الرصيد يدوياً
    if (action === "update_balance") {
      const updatedAgent = await prisma.agent.update({
        where: { id },
        data: { availableBalance: parseFloat(amount) },
      });
      return NextResponse.json({ success: true, data: updatedAgent });
    }

    // 2. تعطيل أو تفعيل الحساب
    if (action === "update_status") {
      const agent = await prisma.agent.findUnique({ where: { id }, select: { userId: true } });
      if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

      const updatedUser = await prisma.user.update({
        where: { id: agent.userId },
        data: { status: status }, // ACTIVE أو SUSPENDED
      });
      return NextResponse.json({ success: true, data: updatedUser });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}