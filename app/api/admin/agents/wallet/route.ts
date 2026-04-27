import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { adminManualSetWalletBalanceInTx, notifyAgentBalanceTopup } from "@/lib/admin-agent-balance";
import { getPrisma } from "@/lib/db";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
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
      const r = await adminManualSetWalletBalanceInTx(tx, resolved, balanceNum, {
        adminId: auth.user.id,
        reason: "ADMIN_WALLET_PATCH",
        ledgerReason: "ADMIN_WALLET_PATCH",
      });
      return r;
    });

    revalidatePath("/agent/dashboard", "layout");

    console.log(
      `[admin-balance] wallet PATCH done agentUserId=${resolved.userId} newBalance=${updated.newBalance} previousBalance=${updated.previousBalance} delta=${updated.delta}`,
    );
    if (updated.delta > 0) {
      await notifyAgentBalanceTopup({
        userId: resolved.userId,
        newBalance: updated.newBalance,
        amountDh: updated.delta,
      });
    }

    return NextResponse.json({ success: true, balance: updated.newBalance });
  } catch (error) {
    console.error("WALLET PATCH ERROR:", error);
    return NextResponse.json({ success: false, message: "Update failed" }, { status: 500 });
  }
}
