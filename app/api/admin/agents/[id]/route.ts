import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminManualSetWalletBalanceInTx, notifyAgentBalanceTopup } from "@/lib/admin-agent-balance";
import { getPrisma } from "@/lib/db";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { requireAdmin, requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAdmin();
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }

  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ error: "DB Error" }, { status: 500 });

    const { action, amount, status, newPassword } = await req.json();

    if (action === "update_balance") {
      const authBalance = await requireAdminPermission("MANUAL_BALANCE_EDIT");
      if (!authBalance.ok) {
        return respondIfAdminAccessDenied(authBalance);
      }
      const newBalanceNum = Number(amount);
      if (!Number.isFinite(newBalanceNum) || newBalanceNum < 0) {
        return NextResponse.json({ error: "Invalid balance" }, { status: 400 });
      }

      const resolved = await resolveAgentWalletIds(prisma, id);
      if (!resolved) {
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
      }

      const result = await prisma.$transaction((tx) =>
        adminManualSetWalletBalanceInTx(tx, resolved, newBalanceNum, {
          adminId: authBalance.user.id,
          reason: "update_balance (admin agents UI)",
          ledgerReason: "ADMIN_AGENTS_ID_PATCH",
        }),
      );

      revalidatePath("/agent/dashboard", "layout");
      console.log(
        `[admin-balance] agents/[id] update_balance agentUserId=${resolved.userId} newBalance=${result.newBalance} previousBalance=${result.previousBalance} delta=${result.delta}`,
      );
      if (result.delta > 0) {
        await notifyAgentBalanceTopup({
          userId: resolved.userId,
          newBalance: result.newBalance,
          amountDh: result.delta,
        });
      }
      return NextResponse.json({ success: true, balance: result.newBalance });
    }

    if (action === "update_status") {
      await prisma.user.update({ where: { id }, data: { status } });
      const agent = await prisma.agent.findUnique({ where: { userId: id } });
      if (agent) {
        await prisma.agent.update({ where: { id: agent.id }, data: { status } });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "reset_password" && newPassword) {
      const hash = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({ where: { id }, data: { passwordHash: hash } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireAdmin();
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }
  try {
    const prisma = getPrisma();
    await prisma?.user.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error" }, { status: 500 });
  }
}
