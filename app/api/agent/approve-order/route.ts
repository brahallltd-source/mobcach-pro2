import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { resolveAgentWalletIds } from "@/lib/agent-wallet-resolve";
import { ensureAgentWallet } from "@/lib/wallet-db";
import { createNotification } from "@/lib/notifications";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import { getAgentGoSportAuth, transferGoSportBalance } from "@/lib/gosport-api";
import { sendWhatsAppNotification } from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ORDER_PROCESSING_STATUS = "agent_processing_transfer";

function parseNumericGoSportId(value: unknown): number | null {
  const raw = String(value ?? "").trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export async function POST(req: Request) {
  let claimedOrderId: string | null = null;
  let claimedOriginalStatus: string | null = null;
  let transferSucceeded = false;
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database not available" }, { status: 500 });
    }

    const session = await getSessionUserFromCookies();
    if (!session || String(session.role ?? "").trim().toUpperCase() !== "AGENT") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json().catch(() => ({}))) as {
      orderId?: string;
      proofUrl?: string;
      proof_url?: string;
      proof?: string;
    };
    const orderId = String(body.orderId ?? "").trim();
    const proofFromBody = String(body.proofUrl ?? body.proof_url ?? body.proof ?? "").trim();
    if (!orderId) {
      return NextResponse.json({ message: "orderId is required" }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id: String(orderId) },
      include: {
        agent: {
          select: { id: true, userId: true, fullName: true, wallet: true },
        },
        player: {
          select: { id: true, userId: true, username: true, gosportUsername: true, phone: true, goSportId: true },
        },
      },
    });
    if (!order || !order.agent) {
      throw new Error("Order or Agent not found");
    }
    if (String(order.agent.userId ?? "").trim() !== String(session.id ?? "").trim()) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (order.walletDeducted || order.status === "completed") {
      throw new Error("هذا الطلب تم تفعيله مسبقاً.");
    }
    if (!["proof_uploaded", "pending_payment"].includes(String(order.status))) {
      throw new Error("الطلب ليس في حالة قابلة للموافقة.");
    }

    const resolved = await resolveAgentWalletIds(prisma, order.agentId);
    if (!resolved) throw new Error("Agent wallet keys not found");
    const wallet = await ensureAgentWallet(prisma, resolved);
    if (Number(wallet.balance || 0) < order.amount) {
      throw new Error(`رصيدك غير كافٍ. المتوفر حالياً: ${wallet.balance} DH`);
    }

    // Phase 1 (Preparation): resolve target GoSport ID from order first, then player profile.
    let targetGoSportId = parseNumericGoSportId(order.gosportUsername);
    if (targetGoSportId === null) {
      targetGoSportId = parseNumericGoSportId(order.player?.goSportId);
    }
    if (targetGoSportId === null) {
      throw new Error("Missing GoSport ID for this player. Cannot process transfer.");
    }

    // Idempotency guard: atomically claim this order before external transfer.
    const claim = await prisma.order.updateMany({
      where: {
        id: order.id,
        walletDeducted: false,
        status: { in: ["proof_uploaded", "pending_payment"] },
      },
      data: {
        status: ORDER_PROCESSING_STATUS,
        updatedAt: new Date(),
      },
    });
    if (claim.count !== 1) {
      throw new Error("Order is already being processed or already completed.");
    }
    claimedOrderId = order.id;
    claimedOriginalStatus = order.status;

    const goSportAuth = await getAgentGoSportAuth(session.id);

    // Phase 2 (External API): run transfer OUTSIDE any DB transaction.
    const transferResult = await transferGoSportBalance(
      goSportAuth.accessToken,
      goSportAuth.agentId,
      targetGoSportId,
      Number(order.amount || 0),
    );
    if (!transferResult.success) {
      throw new Error(transferResult.error || "GoSport transfer failed.");
    }
    transferSucceeded = true;

    // Phase 3 (Local DB Update): fast transaction only for local state.
    const nextWalletBalance = Number(wallet.balance || 0) - Number(order.amount || 0);
    const finalProofUrl = proofFromBody || String(order.proofUrl ?? "").trim() || null;
    const updatedOrder = await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: order.amount },
          ledger: {
            create: {
              agentId: order.agentId,
              type: "debit",
              amount: order.amount,
              reason: `شحن حساب GoSport365: ${order.gosportUsername}`,
              meta: {
                orderId: order.id,
                playerId: order.player?.id ?? null,
                agentProfileId: order.agentId,
                playerEmail: order.playerEmail,
                targetAccount: String(targetGoSportId),
                targetGoSportId,
                type: "PLAYER_DEPOSIT_APPROVE",
              },
            },
          },
        },
      });
      await tx.agent.update({
        where: { id: order.agentId },
        data: { availableBalance: nextWalletBalance },
      });

      const orderUpdate = await tx.order.updateMany({
        where: {
          id: order.id,
          status: ORDER_PROCESSING_STATUS,
          walletDeducted: false,
        },
        data: {
          status: "completed",
          walletDeducted: true,
          proofUrl: finalProofUrl,
          updatedAt: new Date(),
        },
      });
      if (orderUpdate.count !== 1) {
        throw new Error("ORDER_STATE_CONFLICT");
      }
      const upd = await tx.order.findUniqueOrThrow({ where: { id: order.id } });

      if (order.player?.userId) {
        await tx.paymentProofTransaction.create({
          data: {
            amount: Number(order.amount || 0),
            senderName: String(order.player.username ?? order.playerEmail ?? "—"),
            senderPhone: String(order.player.phone ?? "").trim() || null,
            receiptUrl: String(finalProofUrl ?? "").trim() || String(order.proofUrl ?? "").trim() || "no-proof",
            status: "AGENT_APPROVED",
            paymentMethod: order.paymentMethodName || null,
            paymentMethodTitle: order.paymentMethodName || null,
            agentUserId: session.id,
            playerUserId: order.player.userId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          userId: session.id,
          action: "AGENT_ORDER_APPROVED",
          entityType: "Order",
          entityId: order.id,
          meta: {
            type: "PLAYER_DEPOSIT",
            orderId: order.id,
            agentId: order.agentId,
            playerId: order.player?.id ?? null,
            amount: order.amount,
            proofUrl: finalProofUrl,
            targetGoSportId,
          },
        },
      });

      return { updatedOrder: upd, order };
    });

    // Persist ID for legacy players now that transfer succeeded.
    if (order.player?.id && !order.player.goSportId) {
      await prisma.player.updateMany({
        where: { id: order.player.id, OR: [{ goSportId: null }, { goSportId: "" }] },
        data: { goSportId: String(targetGoSportId) },
      });
    }

    // Phase 4 (Notification): non-critical side effects.
    try {
      await prisma.orderMessage.create({
        data: {
          orderId: order.id,
          senderRole: "system",
          message: `✅ Agent approved: Check your balance on gosport365.com.`,
        },
      });
    } catch (messageError) {
      console.error("APPROVE ORDER MESSAGE ERROR:", messageError);
    }

    try {
      const amountDh = Math.round(Number(order.amount || 0));
      const whatsappMessage = `تمت الموافقة على طلب الشحن الخاص بك بنجاح ✅! تمت إضافة ${amountDh} درهم إلى حسابك في GoSport365. حظاً موفقاً!`;
      await sendWhatsAppNotification(String(order.player?.phone ?? "").trim(), whatsappMessage);
    } catch (whatsAppError) {
      console.error("APPROVE ORDER WHATSAPP ERROR:", whatsAppError);
    }

    const playerUser = await prisma.user.findFirst({
      where: {
        email: updatedOrder.order.playerEmail.trim().toLowerCase(),
        deletedAt: null,
        role: { equals: "PLAYER", mode: "insensitive" },
      },
      select: { id: true },
    });
    if (playerUser) {
      await createNotification({
        userId: playerUser.id,
        title: "تم شحن حسابك ✅",
        message: `الوكيل ${updatedOrder.order.agent.fullName} قام بتفعيل طلبك. تفقد حسابك الآن.`,
      });
    }

    return NextResponse.json({
      success: true,
      message: "تمت الموافقة بنجاح. المرجو إبلاغ اللاعب بتفقد حسابه.",
      order: updatedOrder.updatedOrder,
    });
  } catch (error: any) {
    if (claimedOrderId && !transferSucceeded && claimedOriginalStatus) {
      await getPrisma()
        ?.order.updateMany({
          where: {
            id: claimedOrderId,
            status: ORDER_PROCESSING_STATUS,
            walletDeducted: false,
          },
          data: {
            status: claimedOriginalStatus,
            updatedAt: new Date(),
          },
        })
        .catch(() => {});
    }
    console.error("APPROVE ORDER ERROR:", error);
    return NextResponse.json(
      {
        message: error.message || "حدث خطأ أثناء معالجة الطلب",
      },
      { status: 400 }
    );
  }
}
