import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import {
  executionMinutesFromAgentSettings,
  RECHARGE_PROOF_STATUS,
} from "@/lib/recharge-proof-lifecycle";
import { getAgentGoSportAuth, transferGoSportBalance } from "@/lib/gosport-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseBearerToken(authHeader: string | null): string {
  const raw = String(authHeader ?? "").trim();
  if (!raw.toLowerCase().startsWith("bearer ")) return "";
  return raw.slice(7).trim();
}

function parseNumericGoSportId(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

async function runCronProcessTimeouts(req: Request) {
  const expectedSecret = String(process.env.CRON_SECRET ?? "").trim();
  const incomingSecret = parseBearerToken(req.headers.get("authorization"));
  if (!expectedSecret || incomingSecret !== expectedSecret) {
    return NextResponse.json({ ok: false, message: "Unauthorized cron request" }, { status: 401 });
  }

  const prisma = getPrisma();
  if (!prisma) {
    return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 500 });
  }

  const now = Date.now();
  const goSportAuthCache = new Map<string, Awaited<ReturnType<typeof getAgentGoSportAuth>>>();
  const processingRows = await prisma.paymentProofTransaction.findMany({
    where: { status: RECHARGE_PROOF_STATUS.PROCESSING },
    include: {
      agentUser: {
        select: {
          id: true,
          executionTime: true,
          agentProfile: {
            select: {
              id: true,
              fullName: true,
              defaultExecutionTimeMinutes: true,
            },
          },
        },
      },
      playerUser: {
        select: {
          id: true,
          username: true,
          email: true,
          player: {
            select: {
              id: true,
              goSportId: true,
              gosportUsername: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  let checked = 0;
  let expired = 0;
  let autoApproved = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of processingRows) {
    checked += 1;
    const executionWindowMinutes = executionMinutesFromAgentSettings(
      row.agentUser.executionTime,
      row.agentUser.agentProfile?.defaultExecutionTimeMinutes ?? 30,
    );
    const startMs = (row.timerStartedAt ?? row.createdAt).getTime();
    const deadlineMs = startMs + executionWindowMinutes * 60_000;
    if (now <= deadlineMs) continue;

    expired += 1;
    const playerGoSportId =
      parseNumericGoSportId(row.playerUser.player?.goSportId) ??
      parseNumericGoSportId(row.playerUser.player?.gosportUsername);
    if (playerGoSportId === null) {
      skipped += 1;
      console.error("[cron/process-timeouts] Missing numeric player GoSport ID", {
        transactionId: row.id,
        playerUserId: row.playerUser.id,
        playerProfileId: row.playerUser.player?.id ?? null,
      });
      continue;
    }

    try {
      let goSportAuth = goSportAuthCache.get(row.agentUserId);
      if (!goSportAuth) {
        goSportAuth = await getAgentGoSportAuth(row.agentUserId);
        goSportAuthCache.set(row.agentUserId, goSportAuth);
      }

      const transferResult = await transferGoSportBalance(
        goSportAuth.accessToken,
        goSportAuth.agentId,
        playerGoSportId,
        Number(row.amount),
      );
      if (!transferResult.success) {
        failed += 1;
        console.error("[cron/process-timeouts] GoSport transfer failed", {
          transactionId: row.id,
          agentUserId: row.agentUserId,
          playerUserId: row.playerUser.id,
          playerGoSportId,
          amount: row.amount,
          error: transferResult.error,
        });
        continue;
      }

      await prisma.paymentProofTransaction.update({
        where: { id: row.id },
        data: {
          status: RECHARGE_PROOF_STATUS.AUTO_APPROVED,
          agentRejectReason: null,
        },
      });

      await createNotification({
        userId: row.playerUser.id,
        title: "تمت الموافقة التلقائية",
        message: `تمت معالجة طلب الشحن تلقائياً وإرساله إلى GoSport365 (المبلغ ${Math.round(
          Number(row.amount),
        )} MAD).`,
        type: "SUCCESS",
        link: `/player/transactions/${encodeURIComponent(row.id)}`,
      });

      autoApproved += 1;
    } catch (error) {
      failed += 1;
      console.error("[cron/process-timeouts] Auto-processing failed", {
        transactionId: row.id,
        agentUserId: row.agentUserId,
        playerUserId: row.playerUser.id,
        amount: row.amount,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checked,
    expired,
    autoApproved,
    skipped,
    failed,
  });
}

export async function GET(req: Request) {
  return runCronProcessTimeouts(req);
}

export async function POST(req: Request) {
  return runCronProcessTimeouts(req);
}
