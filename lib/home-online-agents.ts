import { UserAccountStatus } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import type { AgentProfileCardAgent } from "@/components/AgentProfileCard";

const MOCK_AGENTS: AgentProfileCardAgent[] = [
  {
    id: "mock-1",
    name: "Agent Simo",
    username: "Simo_pay",
    isOnline: true,
    rating: 96,
    paymentMethods: [
      { id: "m1", methodName: "CIH Bank" },
      { id: "m2", methodName: "Cash Plus" },
    ],
  },
  {
    id: "mock-2",
    name: "Agent Youssef",
    username: "youssef_fast",
    isOnline: true,
    rating: 94,
    paymentMethods: [
      { id: "m3", methodName: "USDT" },
      { id: "m4", methodName: "Wafacash" },
    ],
  },
  {
    id: "mock-3",
    name: "Agent Kamal",
    username: "kamal_cash",
    isOnline: true,
    rating: 98,
    paymentMethods: [{ id: "m5", methodName: "Orange Money" }],
  },
];

const LINKABLE = ["ACTIVE", "active", "account_created", "pending"] as const;

/**
 * Up to `limit` agents marked `online` for the public home spotlight.
 * Falls back to {@link MOCK_AGENTS} when DB is off or no rows match.
 */
export async function getHomeSpotlightAgents(limit = 3): Promise<AgentProfileCardAgent[]> {
  const prisma = getPrisma();
  if (!prisma) return MOCK_AGENTS.slice(0, limit);

  try {
    const rows = await prisma.agent.findMany({
      where: {
        online: true,
        status: { in: [...LINKABLE] },
        user: {
          is: { frozen: false, accountStatus: UserAccountStatus.ACTIVE },
        },
      },
      take: limit,
      orderBy: [{ rating: "desc" }, { updatedAt: "desc" }],
      include: {
        user: { select: { likes: true, dislikes: true } },
        paymentMethods: {
          where: { active: true },
          take: 6,
          orderBy: { updatedAt: "desc" },
          select: { id: true, methodName: true },
        },
      },
    });

    if (rows.length === 0) return MOCK_AGENTS.slice(0, limit);

    return rows.map((a) => {
      const likes = Number(a.user.likes ?? 0) || 0;
      const dislikes = Number(a.user.dislikes ?? 0) || 0;
      const votes = likes + dislikes;
      const ratingPercent = votes > 0 ? Math.round((likes / votes) * 100) : Math.round(Number(a.rating) || 0);

      return {
        id: a.id,
        name: a.fullName || a.username,
        username: a.username,
        isOnline: true,
        rating: Number.isFinite(ratingPercent) ? ratingPercent : Math.round(Number(a.rating) || 0),
        paymentMethods: a.paymentMethods.map((m) => ({
          id: m.id,
          methodName: m.methodName,
        })),
      } satisfies AgentProfileCardAgent;
    });
  } catch {
    return MOCK_AGENTS.slice(0, limit);
  }
}
