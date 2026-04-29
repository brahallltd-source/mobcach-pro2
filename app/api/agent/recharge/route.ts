import { Prisma, type PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getAgentFromMobcashUserCookie } from "@/lib/mobcash-user-cookie";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { notifyAllAdminsOfNewRechargeRequest } from "@/lib/in-app-notifications";
import {
  rejectAgentIfSuspended,
  rejectIfMaintenanceBlocksAgents,
} from "@/lib/agent-account-guard";
import { getOrCreateSystemSettings } from "@/lib/system-settings";
import { computeRechargeMonitoringFlags } from "@/lib/flags";
import { validateTreasuryRechargeInput } from "@/lib/agent-treasury-recharge";
import { getInvitationAffiliatePendingDh } from "@/lib/agent-invitation-affiliate-pending";
import { v4 as uuidv4 } from "uuid";

type AgentSession = { id: string; email: string };

/** Prefer `mobcash_user` cookie; fall back to JWT session so create is not silently blocked. */
async function resolveAgentForRecharge(): Promise<AgentSession | null> {
  const fromCookie = await getAgentFromMobcashUserCookie();
  if (fromCookie) return { id: fromCookie.id, email: fromCookie.email };
  const user = await getSessionUserFromCookies();
  if (user && String(user.role).trim().toUpperCase() === "AGENT") {
    return { id: user.id, email: user.email };
  }
  return null;
}

function serializeRechargeRequest(r: {
  id: string;
  agentId: string;
  agentEmail: string;
  amount: number;
  bonusAmount: number;
  pendingBonusApplied: number;
  adminMethodId: string;
  adminMethodName: string;
  paymentMethodId: string | null;
  txHash: string | null;
  proofUrl: string | null;
  note: string | null;
  status: string;
  gosport365Username: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  const affiliate = Number(r.pendingBonusApplied) || 0;
  const finalCredit = Number(r.amount) + Number(r.bonusAmount) + affiliate;
  return {
    id: r.id,
    agentId: r.agentId,
    agentEmail: r.agentEmail,
    amount: r.amount,
    bonusAmount: r.bonusAmount,
    /** Invitation milestone DH folded into this request (admin + agent UI). */
    pendingBonusApplied: affiliate,
    finalCreditAmount: finalCredit,
    adminMethodId: r.adminMethodId,
    adminMethodName: r.adminMethodName,
    paymentMethodId: r.paymentMethodId,
    txHash: r.txHash,
    proofUrl: r.proofUrl,
    note: r.note,
    status: r.status,
    gosport365Username: r.gosport365Username,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;

const RECHARGE_MIN_FALLBACK = 1000;
/** Max |client − server| for `total_with_bonus` vs `amount + bonusAmount + invitation affiliate`. */
const TOTAL_WITH_BONUS_TOLERANCE = 0.02;

/** Explicit opt-in only — keeps legacy clients (no flag) on amount + platform bonus only. */
function parseApplyInvitationAffiliate(body: Body): boolean {
  if (body.applyAffiliateRewards === true || body.apply_affiliate_rewards === true) return true;
  if (body.useInvitationsBonus === true) return true;
  const s = String(body.applyAffiliateRewards ?? body.apply_affiliate_rewards ?? "").trim();
  if (s === "1" || s.toLowerCase() === "true") return true;
  return false;
}

async function handleAgentTreasuryPost(
  prisma: PrismaClient,
  agent: AgentSession,
  data: Body,
): Promise<NextResponse> {
  const gate = await prisma.user.findUnique({
    where: { id: agent.id },
    select: { applicationStatus: true, hasUsdtAccess: true },
  });
  if (!gate || gate.applicationStatus !== "APPROVED") {
    return NextResponse.json(
      {
        success: false,
        message:
          "Treasury top-up is only available once your agent application is approved",
      },
      { status: 403 }
    );
  }

  const validated = validateTreasuryRechargeInput({
    body: data,
    hasUsdtAccess: Boolean(gate.hasUsdtAccess),
  });
  if (validated.ok === false) {
    return NextResponse.json(
      { success: false, message: validated.message },
      { status: 400 }
    );
  }

  const row = await prisma.agentTransaction.create({
    data: {
      agentId: agent.id,
      amount: validated.value.amount,
      method: validated.value.method,
      status: "PENDING",
      details: validated.value.details as Prisma.InputJsonValue,
      receiptUrl: validated.value.receiptUrl,
      motif: validated.value.motif,
    },
  });

  return NextResponse.json({
    success: true,
    message: "Treasury request submitted",
    transaction: {
      id: row.id,
      amount: row.amount,
      method: row.method,
      status: row.status,
      receiptUrl: row.receiptUrl,
      motif: row.motif,
      details: row.details,
      createdAt: row.createdAt.toISOString(),
    },
  });
}

function parsePositiveAmount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 ? value : null;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const n = parseFloat(value.trim());
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Primary GoSport username from API body (`gosportUsername` or legacy `gosport365_*` keys). */
function resolveGosportUsername(body: Body): string {
  return String(
    body.gosportUsername ??
      body["gosportusername"] ??
      body.gosport365_username ??
      body.gosport365Username ??
      body.targetUsername ??
      body.target_username ??
      ""
  ).trim();
}

function resolveConfirmGosportUsername(body: Body): string {
  return String(
    body.confirm_gosport365_username ??
      body.confirmGosport365Username ??
      body.confirmGosportUsername ??
      body.confirmTargetUsername ??
      body.confirm_target_username ??
      ""
  ).trim();
}

function isMissingGosportDbColumn(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2022") {
    const metaStr = JSON.stringify(error.meta ?? {});
    const msg = error.message || "";
    return /gosport/i.test(metaStr + msg);
  }
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /gosport365Username|gosport/i.test(msg) &&
    /does not exist|Unknown column|not exist in the current database|No such column/i.test(
      msg
    )
  );
}

/** Non-empty trimmed string; must be a valid http(s) URL (typical proof upload link). */
function parseProofUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (!s) return null;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return s;
  } catch {
    return null;
  }
}

/**
 * POST /api/agent/recharge — create a wallet recharge request for the **authenticated** agent.
 * Auth: `mobcash_user` cookie (parsed JSON), or session JWT + DB user with role AGENT. Otherwise 401.
 * Body: `amount` (&gt;= 1000 DH), `bonusAmount` (must equal configured % of `amount` from SystemSettings),
 * `total_with_bonus` (must equal `amount + bonusAmount + invitationAffiliateDh` within tolerance when
 * `applyAffiliateRewards: true`, else `amount + bonusAmount`),
 * optional `applyAffiliateRewards` (boolean, default false) — when true, server adds pending invitation-milestone DH,
 * `proofUrl` (http(s) URL; optional when treasury method is crypto), `transactionHash` / `txHash` (optional for crypto),
 * `admin_method_id`, optional `note`,
 * `gosportUsername` (or `gosport365_username`) and `confirm_gosport365_username` (trimmed, must match).
 * If DB has no `gosport365Username` column yet, the value is stored in `note` as `[gosportUsername:…]`.
 *
 * **Treasury top-up** (separate flow): JSON body with `treasuryTopUp: true` (or `treasury: true`),
 * `amount`, `method`, `details`, `motif`, `receiptUrl` (Cloudinary). See {@link handleAgentTreasuryPost}.
 */
export async function POST(req: Request) {
  try {
    const agent = await resolveAgentForRecharge();
    if (!agent) {
      return NextResponse.json(
        { success: false, message: "Unauthorized" },
        { status: 401 }
      );
    }

    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { success: false, message: "Database unavailable" },
        { status: 500 }
      );
    }

    const maintenanceBlock = await rejectIfMaintenanceBlocksAgents(prisma);
    if (maintenanceBlock) return maintenanceBlock;

    const suspendedBlock = await rejectAgentIfSuspended(prisma, agent.id);
    if (suspendedBlock) return suspendedBlock;

    const data = (await req.json().catch(() => ({}))) as Body;

    if (data.treasuryTopUp === true || data.treasury === true) {
      return handleAgentTreasuryPost(prisma, agent, data);
    }

    const settings = await getOrCreateSystemSettings(prisma);
    const bonusPctConfigured = Number(settings.bonusPercentage);
    const bonusRate =
      Number.isFinite(bonusPctConfigured) && bonusPctConfigured >= 0 && bonusPctConfigured <= 1000
        ? bonusPctConfigured / 100
        : 0.1;

    const minConfigured = Number(settings.minRechargeAmount);
    const minRechargeAmount =
      Number.isFinite(minConfigured) && minConfigured >= 1 ? minConfigured : RECHARGE_MIN_FALLBACK;
    const affiliateMergeAllowed = Boolean(settings.affiliateBonusEnabled);

    const amount = parsePositiveAmount(data.amount);
    if (amount === null) {
      return NextResponse.json(
        { success: false, message: "Invalid amount: must be a number greater than 0" },
        { status: 400 }
      );
    }
    if (amount < minRechargeAmount) {
      const floor = Math.floor(minRechargeAmount);
      return NextResponse.json(
        {
          success: false,
          message: `عذراً، أقل مبلغ مسموح به للشحن هو ${floor} درهم`,
        },
        { status: 400 }
      );
    }

    const expectedBonus = amount * bonusRate;
    const bonusParsed = parsePositiveAmount(
      data.bonusAmount ?? data.bonus_amount
    );
    if (bonusParsed === null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing or invalid bonusAmount: must be a number equal to the configured bonus percentage of the recharge amount",
        },
        { status: 400 }
      );
    }
    const BONUS_TOLERANCE = Math.max(0.05, amount * 1e-9);
    if (Math.abs(bonusParsed - expectedBonus) > BONUS_TOLERANCE) {
      return NextResponse.json(
        {
          success: false,
          message: `bonusAmount must match the platform bonus (${settings.bonusPercentage}% of amount)`,
        },
        { status: 400 }
      );
    }
    const bonusAmount = bonusParsed;

    const totalWithBonus = parsePositiveAmount(
      data.total_with_bonus ?? data.totalWithBonus
    );
    if (totalWithBonus === null) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Missing or invalid total_with_bonus: must be a number matching amount + bonusAmount (+ affiliate bonus when applied)",
        },
        { status: 400 }
      );
    }

    const applyInvitationAffiliate =
      affiliateMergeAllowed && parseApplyInvitationAffiliate(data);

    const agentRow = await prisma.user.findUnique({
      where: { id: agent.id },
      select: { agentProfile: { select: { id: true } } },
    });
    const agentProfileId = agentRow?.agentProfile?.id ?? null;

    let invitationPendingDh = 0;
    if (agentProfileId) {
      const inv = await getInvitationAffiliatePendingDh(prisma, {
        agentUserId: agent.id,
        agentProfileId,
      });
      invitationPendingDh = inv.pendingDh;
    }

    const pendingBonusApplied = applyInvitationAffiliate ? invitationPendingDh : 0;
    const expectedTotal = amount + bonusAmount + pendingBonusApplied;
    if (Math.abs(totalWithBonus - expectedTotal) > TOTAL_WITH_BONUS_TOLERANCE) {
      return NextResponse.json(
        {
          success: false,
          message:
            "total_with_bonus does not match the server-calculated total (amount + platform bonus + invitation affiliate when enabled)",
        },
        { status: 400 }
      );
    }

    const adminMethodId = data.admin_method_id ?? data.adminMethodId;
    const note = String(data.note ?? "");
    const adminMethodName = String(
      data.admin_method_name ?? data.adminMethodName ?? "Bank Transfer"
    );

    if (adminMethodId == null || adminMethodId === "") {
      return NextResponse.json(
        { success: false, message: "Missing required field: admin_method_id" },
        { status: 400 }
      );
    }

    const methodIdStr = String(adminMethodId);
    const paymentMethodRow = await prisma.paymentMethod.findFirst({
      where: { id: methodIdStr },
      select: { type: true, methodName: true },
    });
    const isCryptoPayment =
      String(paymentMethodRow?.type ?? "").toLowerCase() === "crypto" ||
      String(paymentMethodRow?.methodName ?? "").toUpperCase().includes("USDT");

    const proofUrlRaw = data.proofUrl ?? data.proof_url;
    const proofUrlParsed = parseProofUrl(proofUrlRaw);
    const txHashRaw = data.transactionHash ?? data.txHash ?? data.transaction_hash;
    const txHash =
      typeof txHashRaw === "string" && txHashRaw.trim().length > 0
        ? txHashRaw.trim().slice(0, 512)
        : null;

    let proofUrl: string | null = proofUrlParsed;
    if (isCryptoPayment) {
      proofUrl = proofUrlParsed;
      if (proofUrl === null && proofUrlRaw != null && String(proofUrlRaw).trim() !== "") {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid proofUrl: must be a valid http(s) URL when provided",
          },
          { status: 400 }
        );
      }
    } else {
      if (proofUrl === null) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Invalid proofUrl: must be a non-empty string with a valid http(s) URL",
          },
          { status: 400 }
        );
      }
    }

    const gosportUsername = resolveGosportUsername(data);
    const confirmGosport365Username = resolveConfirmGosportUsername(data);

    if (!gosportUsername) {
      return NextResponse.json(
        { success: false, message: "Missing required field: gosportUsername" },
        { status: 400 }
      );
    }
    if (gosportUsername !== confirmGosport365Username) {
      return NextResponse.json(
        {
          success: false,
          message:
            "gosport365_username and confirm_gosport365_username must match exactly",
        },
        { status: 400 }
      );
    }

    /** Logged-in user id from `mobcash_user` (User.id). */
    const userId = agent.id;
    const agentEmail = agent.email;

    const agentMeta = await prisma.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    });
    const monitoringFlags = computeRechargeMonitoringFlags(amount, agentMeta?.createdAt ?? null);

    const requestId = uuidv4();
    const baseRow = {
      id: requestId,
      agentId: userId,
      agentEmail,
      amount,
      bonusAmount,
      pendingBonusApplied,
      adminMethodId: methodIdStr,
      adminMethodName,
      /** Links row to `PaymentMethod` for admin UI (same id as `adminMethodId`). */
      paymentMethodId: methodIdStr,
      txHash,
      proofUrl,
      note,
      status: "PENDING" as const,
      flags: monitoringFlags,
      updatedAt: new Date(),
    };

    let created: Awaited<ReturnType<typeof prisma.rechargeRequest.create>>;
    try {
      created = await prisma.rechargeRequest.create({
        data: { ...baseRow, gosport365Username: gosportUsername },
      });
    } catch (firstError: unknown) {
      console.error("PRISMA CREATE ERROR:", firstError);
      if (!isMissingGosportDbColumn(firstError)) {
        const message =
          firstError instanceof Error ? firstError.message : String(firstError);
        return NextResponse.json({ success: false, message }, { status: 500 });
      }
      console.warn(
        "[recharge] RechargeRequest.gosport365Username column missing; storing gosportUsername in note.",
        firstError instanceof Error ? firstError.message : firstError
      );
      const noteWithFallback = [
        `[gosportUsername:${gosportUsername}]`,
        note.trim(),
      ]
        .filter(Boolean)
        .join("\n");
      try {
        created = await prisma.rechargeRequest.create({
          data: { ...baseRow, note: noteWithFallback },
        });
      } catch (secondError: unknown) {
        console.error("PRISMA CREATE ERROR:", secondError);
        const message =
          secondError instanceof Error ? secondError.message : String(secondError);
        return NextResponse.json({ success: false, message }, { status: 500 });
      }
    }

    try {
      const agentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true },
      });
      const agentUsername =
        String(agentUser?.username ?? "").trim() || agentEmail || "—";
      await notifyAllAdminsOfNewRechargeRequest({
        title: "طلب شحن جديد",
        message: `وصل طلب شحن بقيمة ${amount} من الوكيل ${agentUsername}.`,
        link: "/admin/requests",
      });
    } catch (e) {
      console.error("Recharge admin notification:", e);
    }

    return NextResponse.json({
      success: true,
      message: "Request submitted",
      request: serializeRechargeRequest(created),
    });
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : String(error);
    console.error("POST /api/agent/recharge:", error);
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
