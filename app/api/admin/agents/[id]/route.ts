import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { requireAdminPermission } from "@/lib/server-auth";
import bcrypt from "bcryptjs"; // زدناها باش نخدمو تغيير المودباس حتى هو هنا

export const runtime = "nodejs"; 

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> } 
) {
  const resolvedParams = await params;
  const { id } = resolvedParams; // هادا دابا راه User ID

  const access = await requireAdminPermission("agents");
  if (!access.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 403 });

  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ error: "Database error" }, { status: 500 });

    const body = await req.json();
    const { action, amount, status, newPassword } = body;

    // 1️⃣ تعطيل أو تفعيل الحساب
    if (action === "update_status") {
      // كنحدثو الـ User هو الأول
      const updatedUser = await prisma.user.update({
        where: { id: id },
        data: { status: status }, 
      });
      
      // وإلا كان عندو بروفايل فـ Agent كنحدثوه حتى هو باش مايوقعش تناقض
      const agentProfile = await prisma.agent.findUnique({ where: { userId: id } });
      if (agentProfile) {
        await prisma.agent.update({ where: { id: agentProfile.id }, data: { status: status } });
      }
      return NextResponse.json({ success: true, data: updatedUser });
    }

    // 2️⃣ تعديل الرصيد يدوياً (كنستعملو Wallet upsert باش نخدمو على النطاق الجديد)
    if (action === "update_balance") {
      const updatedWallet = await prisma.wallet.upsert({
        where: { userId: id },
        update: { balance: Number(amount), updatedAt: new Date() },
        create: { 
          userId: id, 
          balance: Number(amount) 
        } as any,
      });
      return NextResponse.json({ success: true, balance: updatedWallet.balance });
    }

    // 3️⃣ تغيير المودباس (بما أننا مجموعين فـ هاد الملف، نديروها حتى هي هنا)
    if (action === "reset_password" && newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { id: id },
        data: { passwordHash: hash }
      });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error: any) {
    console.error("AGENT PATCH ERROR:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}