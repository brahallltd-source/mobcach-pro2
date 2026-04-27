import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { notifyAgentBalanceTopup } from "@/lib/admin-agent-balance";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";
import { dbCreditWallet, dbGetWalletBalance } from "@/lib/wallet-db";
import { applyPendingBonusesToRecharge } from "@/lib/bonus";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireAdminPermission("APPROVE_RECHARGES");
  if (!access.ok) {
    return respondIfAdminAccessDenied(access);
  }
  
  try {
    const { agentId, amount, adminEmail } = await req.json();
    const numericAmount = Number(amount);

    if (!agentId || !String(agentId).trim()) {
      return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ message: "Invalid amount" }, { status: 400 });
    }

    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (prisma) {
        const resolved = await resolveAgentWalletIds(prisma, agentId);
        if (!resolved) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

        const walletKey = resolved.agentTableId;
        const previousBalance = await dbGetWalletBalance(walletKey);

        // 1. زيادة المبلغ الأصلي
        await dbCreditWallet(walletKey, numericAmount, "admin_topup", {
          adminEmail: adminEmail ?? access.user.email,
        });

        // 2. زيادة بونص 10%
        const bonusAmount = Math.floor(numericAmount * 0.1);
        if (bonusAmount > 0) {
          await dbCreditWallet(walletKey, bonusAmount, "admin_topup_bonus", {
            adminEmail: adminEmail ?? access.user.email,
          });
        }

        // 3. تطبيق البونص المعلق (Async/Await) — `PendingBonus.agentId` is `Agent.id`
        const pendingApplied = await applyPendingBonusesToRecharge(
          walletKey,
          String(adminEmail ?? access.user.email),
        );

        const newBalance = await dbGetWalletBalance(walletKey);
        const totalAdded = newBalance - previousBalance;
        console.log(
          `[admin-balance] topup-agent done agentUserId=${resolved.userId} previousBalance=${previousBalance} newBalance=${newBalance} totalAdded=${totalAdded}`,
        );
        if (totalAdded > 0) {
          await notifyAgentBalanceTopup({
            userId: resolved.userId,
            newBalance,
            amountDh: totalAdded,
          });
        }

        revalidatePath("/agent/dashboard", "layout");

        return NextResponse.json({
          success: true,
          summary: {
            previousBalance,
            credited: numericAmount,
            bonus: bonusAmount,
            extra: pendingApplied.totalApplied,
            newBalance,
          },
        });
      }
    }
    return NextResponse.json({ message: "DB Error" }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}