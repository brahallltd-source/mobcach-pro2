import { NextResponse } from "next/server";
import { getPrisma, isDatabaseEnabled } from "@/lib/db";
import { dataPath, readJsonArray } from "@/lib/json";
import { getWalletBalance } from "@/lib/wallet";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let allAgents: any[] = [];

    // 1️⃣ جلب الوكلاء الجداد من قاعدة البيانات (Prisma)
    try {
      if (isDatabaseEnabled()) {
        const prisma = getPrisma();
        if (prisma) {
          // استعملنا any باش نتفاداو مشاكل Typescript فـ الـ Build
          const users = await (prisma.user as any).findMany({
            where: { role: "AGENT" },
            include: { wallet: true, agentProfile: true },
            orderBy: { createdAt: "desc" }
          });
          
          allAgents = users.map((u: any) => ({
            id: u.id,
            fullName: u.agentProfile?.fullName || u.username,
            username: u.username || "بدون اسم",
            email: u.email,
            status: u.status || "ACTIVE",
            availableBalance: u.wallet?.balance ?? u.agentProfile?.availableBalance ?? 0,
            country: u.agentProfile?.country || "MA"
          }));
        }
      }
    } catch (dbError) {
      console.error("DB Fetch Error:", dbError);
    }

    // 2️⃣ جلب الوكلاء القدام من ملف (agents.json)
    try {
      const legacyAgents = readJsonArray<any>(dataPath("agents.json"));
      if (legacyAgents && legacyAgents.length > 0) {
        legacyAgents.forEach((a: any) => {
          // باش ما ندوبلوش الوكلاء اللي ديجا كاينين فالداتابيز
          if (!allAgents.some((dbA) => dbA.id === a.id || dbA.email === a.email)) {
            
            // جلب الصولد ديالهم من السيستيم القديم
            let legacyBalance = a.availableBalance || 0;
            try {
               legacyBalance = getWalletBalance(a.id);
            } catch(e) {}

            allAgents.push({
              id: a.id,
              fullName: a.fullName || a.username,
              username: a.username,
              email: a.email,
              status: a.status || "ACTIVE",
              availableBalance: legacyBalance,
              country: a.country || "MA"
            });
          }
        });
      }
    } catch (jsonError) {
      console.error("JSON Fetch Error:", jsonError);
    }

    return NextResponse.json({ agents: allAgents });
  } catch (error) {
    console.error("GLOBAL FETCH AGENTS ERROR:", error);
    return NextResponse.json({ agents: [] });
  }
}