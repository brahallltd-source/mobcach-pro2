import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { ensureAgentWallet } from "@/lib/wallet-db";
import { requireAdminPermission, respondIfAdminAccessDenied } from "@/lib/server-auth";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const auth = await requireAdminPermission("MANUAL_BALANCE_EDIT");
  if (!auth.ok) {
    return respondIfAdminAccessDenied(auth);
  }

  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database Error" }, { status: 500 });

    const body = (await req.json().catch(() => ({}))) as {
      agentId?: unknown;
      newBalance?: unknown;
      reason?: unknown;
    };

    const rawAgent = body.agentId;
    const newBalanceNum = Number(body.newBalance);
    const reason =
      typeof body.reason === "string" && body.reason.trim().length > 0
        ? body.reason.trim()
        : "Manual balance update by admin";

    if (rawAgent === undefined || rawAgent === null || String(rawAgent).trim() === "") {
      return NextResponse.json({ message: "agentId و newBalance مطلوبان" }, { status: 400 });
    }
    if (!Number.isFinite(newBalanceNum) || newBalanceNum < 0) {
      return NextResponse.json({ message: "newBalance غير صالح" }, { status: 400 });
    }

    const resolved = await resolveAgentWalletIds(prisma, rawAgent);
    if (!resolved) {
      return NextResponse.json({ message: "الوكيل غير موجود" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const wallet = await ensureAgentWallet(tx, resolved);
      const previousBalance = Number(wallet.balance || 0);
      const nextBalance = newBalanceNum;
      const delta = nextBalance - previousBalance;

      const updatedWallet = await tx.wallet.update({
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
            reason: `ADMIN_MANUAL_SET: ${reason}`,
            meta: { previousBalance, newBalance: nextBalance, adminId: auth.user.id },
          },
        });
      }

      return { updatedWallet, previousBalance, newBalance: nextBalance };
    });

    revalidatePath("/agent/dashboard", "layout");

    return NextResponse.json({
      success: true,
      message: "تم تحديث الرصيد بنجاح ✅",
      balance: result.newBalance,
      previousBalance: result.previousBalance,
    });
  } catch (error: unknown) {
    console.error("ADMIN WALLET UPDATE ERROR:", error);
    return NextResponse.json(
      {
        message: "فشل تحديث الرصيد: " + (error instanceof Error ? error.message : "خطأ داخلي"),
      },
      { status: 500 },
    );
  }
}
