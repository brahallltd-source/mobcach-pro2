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
        // جمعنا الحالات بجوج باش نضمنو أننا ما زكلنا حتى وكيل
        status: { in: ["ACTIVE", "active", "account_created"] }, 
      },
      include: {
        wallet: true, // المحفظة باش نعرفو الرصيد
        paymentMethods: true, // طرق الدفع باش يخدم الفلتر
        user: true, // باش نتأكدو أن الحساب مامبلوكيش (frozen)
      },
      orderBy: { updatedAt: "desc" },
    });

    // 3. تنسيق البيانات بالأسماء اللي كيتسناها Frontend
    let formattedAgents = agentProfiles
      .filter((agent) => agent.user?.frozen === false)
      .map((agent: any) => {
        const methods = agent.paymentMethods ? agent.paymentMethods.map((m: any) => m.methodName) : [];
        
        return {
          agentId: agent.id,
          display_name: agent.fullName || agent.username || agent.email,
          username: agent.username,
          email: agent.email,
          online: agent.online,
          rating: agent.rating || 95, // عطيناهم تقييم افتراضي
          trades_count: agent.tradesCount || 0,
          response_minutes: agent.responseMinutes || 15,
          updated_at: agent.updatedAt,
          country: agent.country || "",
          available_balance: agent.wallet?.balance || 0, // 👈 السمية اللي كيتسناها الـ Frontend!
          min_limit: 50, // الحد الأدنى
          max_limit: 10000, // الحد الأقصى
          verified: agent.verified || false,
          featured: (agent.rating || 95) >= 90,
          bank_methods: methods, // 👈 باش يخدم الفلتر ديال All و CIH...
        };
      });

    // 4. تطبيق الفلتر (الدولة، طريقة الدفع، المبلغ)
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
  } catch (error) {
    console.error("AGENT DISCOVERY ERROR:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء جلب قائمة الوكلاء", agents: [] },
      { status: 500 }
    );
  }
}