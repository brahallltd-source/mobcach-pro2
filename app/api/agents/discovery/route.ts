export const dynamic = "force-dynamic";
export const revalidate = 0;

import { UserAccountStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { activeJsonPaymentLabels } from "@/lib/active-payment-labels";
import {
  type AgentPaymentMethodRow,
  parseAgentPaymentMethodsJson,
  toPublicPaymentMethodPayload,
} from "@/lib/agent-payment-settings";
import { getPrisma } from "@/lib/db";
import { USER_SELECT_SAFE_RELATION } from "@/lib/prisma-user-safe-select";

export const runtime = "nodejs";

type DiscoveryAgentRow = {
  paymentMethods: Array<{ id: string; methodName: string; active: boolean }>;
  user: { paymentMethods: unknown } | null;
};

function mergePaymentMethodsForDiscovery(agent: DiscoveryAgentRow) {
  const catalog = parseAgentPaymentMethodsJson(agent.user?.paymentMethods)
    .filter((r) => r.isActive)
    .map((r) => {
      const pub = toPublicPaymentMethodPayload(r as AgentPaymentMethodRow);
      return {
        id: pub.id,
        methodName: pub.methodTitle,
        methodTitle: pub.methodTitle,
        minAmount: pub.minAmount,
        maxAmount: pub.maxAmount,
      };
    });
  const seen = new Set(
    catalog.map((c) => String(c.methodName || "").trim().toLowerCase()).filter(Boolean)
  );
  const extras = (agent.paymentMethods ?? [])
    .filter((m) => m.active)
    .map((m) => ({
      id: m.id,
      methodName: m.methodName,
      methodTitle: m.methodName,
    }))
    .filter((row) => {
      const key = String(row.methodName || "").trim().toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return [...catalog, ...extras];
}

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
        user: {
          is: {
            frozen: false,
            accountStatus: UserAccountStatus.ACTIVE,
          },
        },
      },
      include: {
        wallet: true,
        paymentMethods: {
          where: { active: true },
          orderBy: { updatedAt: "desc" },
          select: { id: true, methodName: true, active: true },
        },
        user: { select: USER_SELECT_SAFE_RELATION },
      },
      orderBy: { updatedAt: "desc" },
    });

    // 3. تنسيق البيانات
    let formattedAgents = agentProfiles.map((agent: any) => {
        const mergedMethods = mergePaymentMethodsForDiscovery(agent as DiscoveryAgentRow);
        const methods = mergedMethods.map((m) => m.methodName);

        const u = agent.user;
        const likes = Number(u?.likes ?? 0) || 0;
        const dislikes = Number(u?.dislikes ?? 0) || 0;
        const totalVotes = likes + dislikes;
        const ratingPercent =
          totalVotes > 0 ? Math.round((likes / totalVotes) * 100) : 0;

        const jsonPills = activeJsonPaymentLabels(u?.paymentMethods);
        const payment_pills = jsonPills.length > 0 ? jsonPills : methods;

        const executionTimeLabel =
          (typeof u?.executionTime === "string" && u.executionTime.trim()) ||
          `${agent.responseMinutes ?? 30} min`;

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
          likes,
          dislikes,
          rating_percent: ratingPercent,
          payment_pills,
          execution_time_label: executionTimeLabel,
          paymentMethods: mergedMethods,
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