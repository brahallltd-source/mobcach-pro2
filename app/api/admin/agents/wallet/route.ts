import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { ensureAgentWallet } from "@/lib/wallet-db";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function PATCH(req: Request) {
  const auth = await requireAdminPermission("MANUAL_BALANCE_EDIT");
  if (!auth.ok) {
    return respondIfAdminAccessDenied(auth, { success: false });
  }

  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ success: false, message: "Database not available" }, { status: 500 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      agentId?: unknown;
      balance?: unknown;
    };

    const rawAgent = body.agentId;
    const balanceNum = Number(body.balance);
    if (rawAgent === undefined || rawAgent === null || String(rawAgent).trim() === "") {
      return NextResponse.json({ success: false, message: "agentId required" }, { status: 400 });
    }
    if (!Number.isFinite(balanceNum) || balanceNum < 0) {
      return NextResponse.json({ success: false, message: "Invalid balance" }, { status: 400 });
    }

    const resolved = await resolveAgentWalletIds(prisma, rawAgent);
    if (!resolved) {
      return NextResponse.json({ success: false, message: "Agent not found" }, { status: 404 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const wallet = await ensureAgentWallet(tx, resolved);
      const previousBalance = Number(wallet.balance || 0);
      const nextBalance = balanceNum;
      const delta = nextBalance - previousBalance;

      const w = await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: nextBalance },
      });

      await tx.balanceLog.create({
        data: {
          adminId: auth.user.id,
          agentId: resolved.userId,
          type: "MANUAL_ADJUST",
          amount: Math.abs(delta),
          operation: delta >= 0 ? "IN" : "OUT",
          bonusApplied: false,
          previousBalance,
          newBalance: nextBalance,
        },
      });

      if (delta !== 0) {
        await tx.walletLedger.create({
          data: {
            agentId: resolved.userId,
            walletId: wallet.id,
            type: delta > 0 ? "credit" : "debit",
            amount: Math.abs(delta),
            reason: "ADMIN_WALLET_PATCH",
            meta: { previousBalance, newBalance: nextBalance, adminId: auth.user.id },
          },
        });
      }

      return w;
    });

    revalidatePath("/agent/dashboard", "layout");

    return NextResponse.json({ success: true, balance: updated.balance });
  } catch (error) {
    console.error("WALLET PATCH ERROR:", error);
    return NextResponse.json({ success: false, message: "Update failed" }, { status: 500 });
  }
}
