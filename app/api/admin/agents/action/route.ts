import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs"; // 🟢 ضرورية باش bcrypt مايحبسش ليك الـ Build

export async function PATCH(req: Request) {
  try {
    const prisma = getPrisma();
    const { action, agentId, status, newPassword } = await req.json();

    const agent = await prisma?.agent.findUnique({ where: { id: agentId } });
    if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

    // 1. تجميد أو تفعيل الحساب
    if (action === "update_status") {
      await prisma?.$transaction([
        prisma.agent.update({ where: { id: agentId }, data: { status } }),
        prisma.user.update({ where: { id: agent.userId }, data: { status } })
      ]);
      return NextResponse.json({ success: true });
    }

    // 2. تغيير كلمة المرور
    if (action === "reset_password" && newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      await prisma?.user.update({
        where: { id: agent.userId },
        data: { passwordHash: hash }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ message: "Error processing request" }, { status: 500 });
  }
}

// 3. حذف الحساب نهائياً
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();

    const agent = await prisma?.agent.findUnique({ where: { id: String(agentId) } });
    if (agent) {
      await prisma?.$transaction([
        prisma.agent.delete({ where: { id: agent.id } }),
        prisma.user.delete({ where: { id: agent.userId } })
      ]);
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ message: "Error deleting agent" }, { status: 500 });
  }
}