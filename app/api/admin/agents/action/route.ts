import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs"; // باش الـ Build ما يتبلوكاتش بـ bcrypt

export async function PATCH(req: Request) {
  try {
    const prisma = getPrisma();
    const { action, agentId, status, newPassword } = await req.json();

    const user = await prisma?.user.findUnique({ where: { id: agentId } });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    // 🛑 تجميد أو تفعيل
    if (action === "update_status") {
      await prisma?.user.update({ where: { id: agentId }, data: { status } });
      const agentProf = await prisma?.agent.findUnique({ where: { userId: agentId } });
      if (agentProf) {
        await prisma?.agent.update({ where: { id: agentProf.id }, data: { status } });
      }
      return NextResponse.json({ success: true });
    }

    // 🔑 تغيير المودباس
    if (action === "reset_password" && newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      await prisma?.user.update({
        where: { id: agentId },
        data: { passwordHash: hash }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ message: "Invalid action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ message: "Error processing request" }, { status: 500 });
  }
}

// 🗑️ حذف الحساب
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    const prisma = getPrisma();

    if (agentId) {
      // 🟢 ملي كتمسح الـ User كيتمسح معاه كولشي (cascade)
      await prisma?.user.delete({ where: { id: String(agentId) } });
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ message: "Error deleting agent" }, { status: 500 });
  }
}