import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/server-auth";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  // 1. التأكد من صلاحيات الإدارة
  const access = await requireAdminPermission("overview");
  if (!access.ok) {
    return NextResponse.json({ message: access.message }, { status: access.status });
  }

  try {
    const prisma = getPrisma();
    if (!prisma) return NextResponse.json({ message: "Database not available" }, { status: 500 });

    // 2. جلب جميع البيانات في وقت واحد (Parallel Execution)
    const [
      usersCount,
      playersCount,
      agents,
      referralsCount,
      orderStats,
      orderVolume,
      completedVolume,
      pendingWithdrawals,
      pendingTopups,
      fraudFlagsCount
    ] = await Promise.all([
      prisma.user.count(),
      prisma.player.count(),
      prisma.agent.findMany({ select: { status: true } }),
      prisma.referral.count(),
      prisma.order.groupBy({ by: ['status'], _count: true }),
      prisma.order.aggregate({ _sum: { amount: true } }),
      prisma.order.aggregate({ where: { status: "completed" }, _sum: { amount: true } }),
      prisma.withdrawal.count({ where: { status: "pending" } }),
      prisma.rechargeRequest.count({ where: { status: "pending" } }),
      prisma.fraudFlag.count({ where: { resolved: false } })
    ]);

    // 3. معالجة بيانات النمو (Growth)
    const growth = {
      users: usersCount,
      players: playersCount,
      agents: agents.filter(a => ["ACTIVE", "active", "account_created"].includes(a.status)).length,
      pendingAgents: agents.filter(a => ["pending", "pending_agent_review"].includes(a.status)).length,
      referrals: referralsCount,
    };

    // 4. معالجة البيانات المالية (Finance)
    const finance = {
      orders: orderStats.reduce((acc, curr) => acc + curr._count, 0),
      orderVolume: orderVolume._sum.amount || 0,
      completedOrderVolume: completedVolume._sum.amount || 0,
      withdrawalsPending: pendingWithdrawals,
      topupsPending: pendingTopups,
    };

    // 5. معالجة بيانات الثقة والأمان (Trust)
    // ملاحظة: قمنا بحساب الطلبات المشبوهة من جدول FraudFlag الجديد
    const trust = {
      complaints: 0, // يمكنك ربطها بجدول التذاكر إذا توفر لاحقاً
      duplicateProofs: 0, // يمكن حسابها عبر استعلام groupBy لـ proofHash
      flaggedOrders: fraudFlagsCount,
      completedOrders: orderStats.find(s => s.status === "completed")?._count || 0,
    };

    // 6. تنسيق بيانات الشارت (Chart Data)
    const statusMap: Record<string, number> = {};
    orderStats.forEach(stat => { statusMap[stat.status] = stat._count; });

    const orderStatusChart = [
      { name: "Pending", value: statusMap["pending_payment"] || 0 },
      { name: "Proof", value: statusMap["proof_uploaded"] || 0 },
      { name: "Review", value: (statusMap["flagged_for_review"] || 0) + fraudFlagsCount },
      { name: "Approved", value: statusMap["agent_approved_waiting_player"] || 0 },
      { name: "Completed", value: statusMap["completed"] || 0 },
    ];

    return NextResponse.json({ growth, finance, trust, orderStatusChart });
  } catch (error) {
    console.error("ADMIN ANALYTICS ERROR:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء استخراج الإحصائيات التحليلية." },
      { status: 500 }
    );
  }
}