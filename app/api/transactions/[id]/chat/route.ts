import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  executionMinutesFromAgentSettings,
  normalizeRechargeProofStatus,
} from "@/lib/recharge-proof-lifecycle";
import { createNotification } from "@/lib/notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_CONTENT = 8000;

function unauthorizedJson() {
  return NextResponse.json({ error: "Unauthorized", message: "Unauthorized" }, { status: 401 });
}

/** Fast cookie gate (middleware parity): no JWT / user cookie at all → 401 without throwing. */
async function missingSessionCredentialsResponse(): Promise<NextResponse | null> {
  const store = await cookies();
  const sessionCookie = store.get("mobcash_session")?.value;
  const legacyToken =
    store.get("token")?.value ||
    store.get("auth_token")?.value ||
    store.get("mobcash_token")?.value;
  const mobcashUser = store.get("mobcash_user")?.value;
  if (!sessionCookie && !legacyToken && !mobcashUser) {
    return unauthorizedJson();
  }
  return null;
}

/** Ephemeral “user X is typing” per proof (best-effort; single-instance / warm lambda). */
const chatTypingByProof = new Map<string, { userId: string; at: number }>();
const TYPING_TTL_MS = 4500;

function peerTypingForViewer(proofId: string, viewerUserId: string): boolean {
  const v = chatTypingByProof.get(proofId);
  if (!v || v.userId === viewerUserId) return false;
  return Date.now() - v.at < TYPING_TTL_MS;
}

type RouteCtx = { params: Promise<{ id: string }> };

async function authorizeProof(
  prisma: PrismaClient,
  proofId: string,
  userId: string,
  roleUpper: string
) {
  const row = await prisma.paymentProofTransaction.findUnique({
    where: { id: proofId },
    select: {
      id: true,
      status: true,
      amount: true,
      senderName: true,
      senderPhone: true,
      receiptUrl: true,
      agentUserId: true,
      playerUserId: true,
      createdAt: true,
      paymentMethodTitle: true,
      paymentMethod: true,
      agentRejectReason: true,
      playerComment: true,
      playerRating: true,
      disputeMessage: true,
      timerStartedAt: true,
      isLatePenaltyApplied: true,
    },
  });
  if (!row) return { error: NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 }) };
  const isAgent = roleUpper === "AGENT" && row.agentUserId === userId;
  const isPlayer = roleUpper === "PLAYER" && row.playerUserId === userId;
  if (!isAgent && !isPlayer) {
    return { error: NextResponse.json({ message: "غير مصرّح" }, { status: 403 }) };
  }
  const role: "AGENT" | "PLAYER" = isAgent ? "AGENT" : "PLAYER";
  return { row, role };
}

/** GET — messages for this payment-proof transaction (ascending). Marks peer messages as read for the viewer. */
export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database unavailable" }, { status: 503 });
    }

    const cred = await missingSessionCredentialsResponse();
    if (cred) return cred;

    const session = await getSessionUserFromCookies();
    if (!session) {
      return unauthorizedJson();
    }

    const roleUpper = String(session.role ?? "").trim().toUpperCase();
    const { id } = await ctx.params;
    const proofId = String(id || "").trim();
    if (!proofId) {
      return NextResponse.json({ message: "معرّف غير صالح" }, { status: 400 });
    }

    const auth = await authorizeProof(prisma, proofId, session.id, roleUpper);
    if ("error" in auth) return auth.error;

    const agentProfile = await prisma.agent.findUnique({
      where: { userId: auth.row.agentUserId },
      select: {
        defaultExecutionTimeMinutes: true,
        user: { select: { executionTime: true } },
      },
    });
    const executionWindowMinutes = executionMinutesFromAgentSettings(
      agentProfile?.user?.executionTime,
      agentProfile?.defaultExecutionTimeMinutes ?? 30
    );

    const messages = await prisma.message.findMany({
      where: { transactionId: proofId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        transactionId: true,
        senderId: true,
        senderRole: true,
        content: true,
        isRead: true,
        createdAt: true,
      },
    });

    const unreadCount = messages.filter(
      (m) => m.senderId !== session.id && !m.isRead
    ).length;

    if (unreadCount > 0) {
      await prisma.message.updateMany({
        where: {
          transactionId: proofId,
          senderId: { not: session.id },
          isRead: false,
        },
        data: { isRead: true },
      });
    }

    const serialized = messages.map((m) => ({
      id: m.id,
      transactionId: m.transactionId,
      senderId: m.senderId,
      senderRole: m.senderRole,
      content: m.content,
      isRead: m.senderId === session.id ? m.isRead : true,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({
      messages: serialized,
      unreadCount,
      peerTyping: peerTypingForViewer(proofId, session.id),
      transaction: {
        id: auth.row.id,
        status: normalizeRechargeProofStatus(auth.row.status),
        amount: auth.row.amount,
        senderName: auth.row.senderName,
        senderPhone: auth.row.senderPhone,
        receiptUrl: auth.row.receiptUrl,
        paymentMethodTitle: auth.row.paymentMethodTitle,
        paymentMethod: auth.row.paymentMethod,
        agentRejectReason: auth.row.agentRejectReason,
        playerComment: auth.row.playerComment,
        playerRating: auth.row.playerRating,
        disputeMessage: auth.row.disputeMessage,
        timerStartedAt: auth.row.timerStartedAt?.toISOString() ?? null,
        isLatePenaltyApplied: auth.row.isLatePenaltyApplied,
        executionWindowMinutes,
        createdAt: auth.row.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("GET /api/transactions/[id]/chat", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}

/** POST — append a chat message (sender taken from session). Body: `{ content: string }`. */
export async function POST(req: Request, ctx: RouteCtx) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database unavailable" }, { status: 503 });
    }

    const cred = await missingSessionCredentialsResponse();
    if (cred) return cred;

    const session = await getSessionUserFromCookies();
    if (!session) {
      return unauthorizedJson();
    }

    const roleUpper = String(session.role ?? "").trim().toUpperCase();
    const { id } = await ctx.params;
    const proofId = String(id || "").trim();
    if (!proofId) {
      return NextResponse.json({ message: "معرّف غير صالح" }, { status: 400 });
    }

    const auth = await authorizeProof(prisma, proofId, session.id, roleUpper);
    if ("error" in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as {
      content?: string;
      typing?: boolean;
      senderId?: string;
      senderRole?: string;
    };

    if (body.typing === true) {
      chatTypingByProof.set(proofId, { userId: session.id, at: Date.now() });
      return NextResponse.json({ ok: true });
    }

    const content = String(body.content ?? "").trim();
    if (!content || content.length > MAX_CONTENT) {
      return NextResponse.json({ message: "نص الرسالة غير صالح" }, { status: 400 });
    }

    const senderRole = auth.role;

    const created = await prisma.message.create({
      data: {
        transactionId: proofId,
        senderId: session.id,
        senderRole,
        content,
        isRead: false,
      },
      select: {
        id: true,
        transactionId: true,
        senderId: true,
        senderRole: true,
        content: true,
        isRead: true,
        createdAt: true,
      },
    });

    try {
      const peerUserId =
        senderRole === "AGENT" ? auth.row.playerUserId : auth.row.agentUserId;
      const preview =
        content.length > 120 ? `${content.slice(0, 120)}…` : content;
      const title =
        senderRole === "AGENT" ? "New message from agent" : "New message from player";
      const link =
        senderRole === "AGENT"
          ? `/player/transactions/${encodeURIComponent(proofId)}`
          : "/agent/transactions";
      await createNotification({
        userId: peerUserId,
        title,
        message: preview,
        type: "INFO",
        link,
      });
    } catch (notifErr) {
      console.warn("Transaction chat peer notification:", notifErr);
    }

    return NextResponse.json({
      message: {
        id: created.id,
        transactionId: created.transactionId,
        senderId: created.senderId,
        senderRole: created.senderRole,
        content: created.content,
        isRead: created.isRead,
        createdAt: created.createdAt.toISOString(),
      },
    });
  } catch (e) {
    console.error("POST /api/transactions/[id]/chat", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
