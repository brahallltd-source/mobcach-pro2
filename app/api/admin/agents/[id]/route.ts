import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const prisma = getPrisma();
    const { action, amount, status, newPassword } = await req.json();

    if (action === "update_balance") {
      await prisma?.wallet.upsert({
        where: { userId: id },
        update: { balance: Number(amount) },
        create: { userId: id, balance: Number(amount) } as any,
      });
      return NextResponse.json({ success: true });
    }

    if (action === "update_status") {
      await prisma?.user.update({ where: { id }, data: { status } });
      return NextResponse.json({ success: true });
    }

    if (action === "reset_password" && newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      await prisma?.user.update({ where: { id }, data: { passwordHash: hash } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const prisma = getPrisma();
    await prisma?.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}