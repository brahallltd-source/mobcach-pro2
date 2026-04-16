export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const prisma = getPrisma();

    if (!prisma) {
      return NextResponse.json({ agents: [] });
    }

    // 1. قراءة الفلتر من الرابط (URL)
    const { searchParams } = new URL(req.url);
    const countryFilter = searchParams.get("country") || "";
    const methodFilter = searchParams.get("method") || "All";
    const amountFilter = Number(searchParams.get("amount")) || 0;

    // 2. جلب الوكلاء النشيطين مع المحفظة وطرق الدفع
    const agentProfiles = await prisma.agent.findMany({
      where: {
        // نضمن جلب الوكلاء اللي حالتهم تسمح بالربط
        status: { in: ["ACTIVE", "active", "account_created", "pending"] }, 
      },
      include: {
        wallet: true, 
        paymentMethods: true, 
        user: true, 
      },
      orderBy: { updatedAt: "desc" },
    });

    // 3. تنسيق البيانات
    let formattedAgents = agentProfiles
      .filter((agent) => agent.user?.frozen === false) // حماية: ما نبينوش اللي مبلوكيين
      .map((agent: any) => {
        const methods = agent.paymentMethods 
          ? agent.paymentMethods.map((m: any) => m.methodName) 
          : [];
        
        return {
          // 🟢 هاد الـ ID هو اللي كيتستعمل فـ دالة handleDirectSelectAgent
          agentId: agent.id, 
          display_name: agent.fullName || agent.username || agent.email,
          username: agent.username,
          email: agent.email,
          online: agent.online,
          rating: agent.rating || 98, 
          trades_count: agent.tradesCount || 0,
          response_minutes: agent.responseMinutes || 5,
          updated_at: agent.updatedAt,
          country: agent.country || "Morocco",
          available_balance: agent.wallet?.balance || 0,
          min_limit: 50,
          max_limit: 10000,
          verified: agent.verified || false,
          featured: (agent.rating || 95) >= 90,
          bank_methods: methods, 
        };
      });

    // 4. تطبيق الفلتر (Logic)
    if (countryFilter) {
      formattedAgents = formattedAgents.filter(
        (a) => a.country.toLowerCase() === countryFilter.toLowerCase()
      );
    }

    if (methodFilter && methodFilter !== "All") {
      formattedAgents = formattedAgents.filter(
        (a) => a.bank_methods.includes(methodFilter)
      );
    }

    if (amountFilter > 0) {
      formattedAgents = formattedAgents.filter(
        (a) => a.available_balance >= amountFilter
      );
    }

    return NextResponse.json({ agents: formattedAgents });

  } catch (error: any) {
    console.error("AGENT DISCOVERY ERROR:", error.message);
    return NextResponse.json(
      { message: "تعذر جلب قائمة الوكلاء حالياً", agents: [] },
      { status: 500 }
    );
  }
}