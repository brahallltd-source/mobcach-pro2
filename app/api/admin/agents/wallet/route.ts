export const dynamic = "force-dynamic"; 
export const revalidate = 0;           

import { NextResponse } from "next/server";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import { createWalletIfMissing } from "@/lib/wallet";

export const runtime = "nodejs";

/**
 * 🔍 جلب معلومات المحفظة لوكيل معين
 * GET /api/admin/agents/wallet?agentId=...
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const agentId = searchParams.get("agentId");
    
    if (!agentId) {
      return NextResponse.json({ message: "agentId is required", wallet: null }, { status: 400 });
    }

    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (prisma) {
        // كنقلبو على المحفظة، وإلا مالقيناهاش كنكرييوها بـ 0
        let wallet = await prisma.wallet.findUnique({ 
          where: { agentId: String(agentId) } 
        });

        if (!wallet) {
          wallet = await prisma.wallet.create({ 
            data: { agentId: String(agentId), balance: 0 } 
          });
        }

        return NextResponse.json({
          wallet: {
            agentId: wallet.agentId,
            balance: wallet.balance,
            updated_at: wallet.updatedAt,
          }
        });
      }
    }

    // Fallback لـ Local Wallet إلا كانت الداتابيز مطفية
    return NextResponse.json({ wallet: createWalletIfMissing(agentId) });
  } catch (error) {
    console.error("GET AGENT WALLET ERROR:", error);
    return NextResponse.json({ message: "Internal server error", wallet: null }, { status: 500 });
  }
}

/**
 * 💰 تحديث الرصيد يدوياً من طرف الآدمين
 * PATCH /api/admin/agents/wallet
 */
export async function PATCH(req: Request) {
  try {
    const { agentId, balance } = await req.json();

    if (!agentId) {
      return NextResponse.json({ message: "agentId is required" }, { status: 400 });
    }

    if (isDatabaseEnabled()) {
      const prisma = getPrisma();
      if (prisma) {
        // استخدام upsert لضمان التحديث حتى لو لم تكن المحفظة موجودة مسبقاً
        const updatedWallet = await prisma.wallet.upsert({
          where: { agentId: String(agentId) },
          update: { 
            balance: Number(balance),
            updatedAt: new Date()
          },
          create: { 
            agentId: String(agentId), 
            balance: Number(balance) 
          },
        });

        return NextResponse.json({
          success: true,
          message: "تم تحديث الرصيد بنجاح",
          balance: updatedWallet.balance
        });
      }
    }

    return NextResponse.json({ message: "Database connection error" }, { status: 503 });
  } catch (error) {
    console.error("PATCH AGENT WALLET ERROR:", error);
    return NextResponse.json({ message: "Failed to update balance" }, { status: 500 });
  }
}