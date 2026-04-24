import type { Prisma } from "@prisma/client";
import { mergeRechargeRequestFlagsForDisplay } from "@/lib/flags";

/** Same `include` for admin list + history APIs. */
export const adminRechargeRequestInclude = {
  agent: true,
  paymentMethod: true,
} satisfies Prisma.RechargeRequestInclude;

export type AdminRechargeRequestWithRelations = Prisma.RechargeRequestGetPayload<{
  include: typeof adminRechargeRequestInclude;
}>;

/** Shared JSON shape for `GET /api/admin/recharge-requests` and `.../history`. */
export function toAdminRechargeRequestJson(r: AdminRechargeRequestWithRelations) {
  const user = r.agent;
  const storedBonus = Number(r.bonusAmount);
  const bonus10 =
    Number.isFinite(storedBonus) && storedBonus > 0
      ? storedBonus
      : Math.floor(Number(r.amount) * 0.1);

  const agentCreated = user?.createdAt ?? null;
  const flags = mergeRechargeRequestFlagsForDisplay(r.flags as string[] | undefined, Number(r.amount), agentCreated);

  const pm = r.paymentMethod;
  const methodDisplayName =
    pm?.methodName?.trim() ||
    pm?.accountName?.trim() ||
    r.adminMethodName?.trim() ||
    "—";

  return {
    id: r.id,
    agentId: r.agentId,
    agentEmail: r.agentEmail,
    amount: r.amount,
    bonusAmount: r.bonusAmount,
    bonus10Percent: bonus10,
    totalWithBonusApprox: Number(r.amount) + bonus10,
    adminMethodId: r.adminMethodId,
    adminMethodName: r.adminMethodName,
    paymentMethodId: r.paymentMethodId,
    paymentMethod: pm
      ? {
          id: pm.id,
          methodName: pm.methodName,
          type: pm.type,
          currency: pm.currency,
          accountName: pm.accountName,
          rib: pm.rib,
        }
      : null,
    methodDisplayName,
    proofUrl: r.proofUrl,
    note: r.note,
    status: r.status,
    flags,
    gosport365Username: r.gosport365Username,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    agent: user
      ? {
          username: user.username ?? "",
          email: user.email ?? r.agentEmail,
        }
      : null,
  };
}
