import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; // هادا دابا راه User ID 100%
  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ error: "DB Error" }, { status: 500 });

    const { action, amount, status, newPassword } = await req.json();

    // 💰 1. تعديل الرصيد
    if (action === "update_balance") {
      const agent = await prisma.agent.findUnique({ where: { userId: id } });
      if (agent) {
        // كنقلبو على المحفظة ونحدثوها
        const wallet = await prisma.wallet.findFirst({ 
          where: { OR: [{ userId: id }, { agentId: agent.id }] } 
        });
        
        if (wallet) {
          await prisma.wallet.update({
            where: { id: wallet.id },
            data: { balance: Number(amount) }
          });
        } else {
          await prisma.wallet.create({
            data: { userId: id, agentId: agent.id, balance: Number(amount) }
          });
        }
      }
      return NextResponse.json({ success: true });
    }

    // 🛑 2. تغيير الحالة (تجميد / تفعيل)
    if (action === "update_status") {
      await prisma.user.update({ where: { id }, data: { status } });
      const agent = await prisma.agent.findUnique({ where: { userId: id } });
      if (agent) {
        await prisma.agent.update({ where: { id: agent.id }, data: { status } });
      }
      return NextResponse.json({ success: true });
    }

    // 🔑 3. تغيير كلمة المرور
    if (action === "reset_password" && newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

// 🗑️ 4. حذف الحساب
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const prisma = getPrisma();
    // Prisma Cascade غادي يمسح الـ User ويمسح معاه الـ Agent والـ Wallet ديالو أوتوماتيكيا
    await prisma?.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}