import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { creditWallet, getWalletBalance } from "@/lib/wallet";
import { dbCreditWallet, dbGetWalletBalance } from "@/lib/wallet-db";
import { applyPendingBonusesToRecharge } from "@/lib/bonus";
import { createNotification } from "@/lib/notifications";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import { dataPath, readJsonArray } from "@/lib/json";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const access = await requireAdminPermission("wallets");
  if (!access.ok) return NextResponse.json({ message: access.message } , { status: access.status });
  
  try {
    const { agentId, amount, adminEmail } = await req.json();
    if (!agentId || !amount) return NextResponse.json({ message: "agentId and amount are required" }, { status: 400 });
    
    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount < 1000) return NextResponse.json({ message: "Minimum top-up is 1000 DH" }, { status: 400 });

    // 1. مسار قاعدة البيانات (Prisma)
    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (prisma) {
        // فحص الوكيل (يقبل الحالة القديمة والجديدة)
        const agent = await prisma.agent.findUnique({ where: { id: String(agentId) } });
        if (!agent || !["ACTIVE", "active", "account_created"].includes(agent.status)) {
          return NextResponse.json({ message: "Agent not found or inactive" }, { status: 404 });
        }

        const previousBalance = await dbGetWalletBalance(String(agentId));
        const baseAmount = numericAmount;
        const bonusAmount = Math.floor(numericAmount * 0.1);
        
        await dbCreditWallet(String(agentId), baseAmount, "admin_topup", { adminEmail });
        if (bonusAmount > 0) await dbCreditWallet(String(agentId), bonusAmount, "admin_topup_bonus", { adminEmail, baseAmount });
        
        // 🟢 هنا كاين await - هادي ناضية
        const pendingApplied = await applyPendingBonusesToRecharge(String(agentId), adminEmail);
        
        const newBalance = await dbGetWalletBalance(String(agentId));
        
        createNotification({ 
          targetRole: "agent", 
          targetId: String(agentId), 
          title: "Wallet credited", 
          message: `Admin topped up your wallet by ${baseAmount} DH (+${bonusAmount} fixed bonus${pendingApplied.totalApplied ? ` + ${pendingApplied.totalApplied} pending bonus` : ""}).` 
        });

        return NextResponse.json({ 
          message: "Agent topped up successfully", 
          summary: { agentId, previousBalance, creditedBase: baseAmount, creditedBonus: bonusAmount, pendingBonusApplied: pendingApplied.totalApplied, newBalance } 
        });
      }
    }

    // 2. مسار JSON (Legacy) - هاد البلاصة فين كان المشكل
    const agents = readJsonArray<any>(dataPath("agents.json"));
    const agentJson = agents.find((item) => String(item.id) === String(agentId));
    if (!agentJson) return NextResponse.json({ message: "Agent not found" }, { status: 404 });

    const previousBalance = getWalletBalance(agentId);
    const baseAmount = numericAmount;
    const bonusAmount = Math.floor(numericAmount * 0.1);
    
    creditWallet(agentId, baseAmount, "admin_topup", { adminEmail });
    if (bonusAmount > 0) creditWallet(agentId, bonusAmount, "admin_topup_bonus", { adminEmail, baseAmount });
    
    // 🟢 التعديل الجوهري: زدنا await هنا حيت الدالة ولات Async دابا
    const pendingApplied = await applyPendingBonusesToRecharge(String(agentId), adminEmail);
    
    const newBalance = getWalletBalance(agentId);
    
    createNotification({ 
      targetRole: "agent", 
      targetId: String(agentId), 
      title: "Wallet credited", 
      message: `Admin topped up your wallet by ${baseAmount} DH (+${bonusAmount} fixed bonus${pendingApplied.totalApplied ? ` + ${pendingApplied.totalApplied} pending bonus` : ""}).` 
    });

    return NextResponse.json({ 
      message: "Agent topped up successfully", 
      summary: { agentId, previousBalance, creditedBase: baseAmount, creditedBonus: bonusAmount, pendingBonusApplied: pendingApplied.totalApplied, newBalance } 
    });

  } catch (error) {
    console.error("TOPUP ERROR:", error);
    return NextResponse.json({ message: "Something went wrong during wallet top-up." }, { status: 500 });
  }
}