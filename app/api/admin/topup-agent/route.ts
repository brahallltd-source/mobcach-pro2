import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { creditWallet, getWalletBalance } from "@/lib/wallet";
import { dbCreditWallet, dbGetWalletBalance } from "@/lib/wallet-db";
import { applyPendingBonusesToRecharge } from "@/lib/bonus";
import { createNotification } from "@/lib/notifications";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message }, { status: access.status });
  
  try {
    const { agentId, amount, adminEmail } = await req.json();
    const numericAmount = Number(amount);

    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (prisma) {
        const agent = await prisma.agent.findUnique({ where: { id: String(agentId) } });
        if (!agent) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

        const previousBalance = await dbGetWalletBalance(String(agentId));
        
        // 1. زيادة المبلغ الأصلي
        await dbCreditWallet(String(agentId), numericAmount, "admin_topup", { adminEmail });
        
        // 2. زيادة بونص 10%
        const bonusAmount = Math.floor(numericAmount * 0.1);
        if (bonusAmount > 0) {
          await dbCreditWallet(String(agentId), bonusAmount, "admin_topup_bonus", { adminEmail });
        }
        
        // 3. تطبيق البونص المعلق (Async/Await)
        const pendingApplied = await applyPendingBonusesToRecharge(String(agentId), adminEmail);
        
        const newBalance = await dbGetWalletBalance(String(agentId));
        
        return NextResponse.json({ 
          success: true,
          summary: { previousBalance, credited: numericAmount, bonus: bonusAmount, extra: pendingApplied.totalApplied, newBalance } 
        });
      }
    }
    return NextResponse.json({ message: "DB Error" }, { status: 500 });
  } catch (error) {
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}