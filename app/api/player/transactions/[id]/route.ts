import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { getSessionUserFromCookies } from "@/lib/server-session-user";
import {
  normalizeRechargeProofStatus,
  RECHARGE_PROOF_STATUS,
} from "@/lib/recharge-proof-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  action?: string;
  disputeMessage?: string;
  playerRating?: boolean;
  playerComment?: string;
  predefinedComment?: string;
};

/**
 * PATCH — player lifecycle: confirm receipt, dispute, or submit feedback after confirmation.
 */
export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "Database unavailable" }, { status: 503 });
    }

    const session = await getSessionUserFromCookies();
    if (!session || String(session.role ?? "").trim().toUpperCase() !== "PLAYER") {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const proofId = String(id || "").trim();
    if (!proofId) {
      return NextResponse.json({ message: "معرّف غير صالح" }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as Body;
    const action = String(body.action || "").toLowerCase();

    const row = await prisma.paymentProofTransaction.findFirst({
      where: { id: proofId, playerUserId: session.id },
    });
    if (!row) {
      return NextResponse.json({ message: "الطلب غير موجود" }, { status: 404 });
    }

    const st = normalizeRechargeProofStatus(row.status);

    if (action === "confirm") {
      if (st !== RECHARGE_PROOF_STATUS.AGENT_APPROVED) {
        return NextResponse.json({ message: "لا يمكن التأكيد في هذه الحالة" }, { status: 400 });
      }
      const updated = await prisma.paymentProofTransaction.update({
        where: { id: proofId },
        data: { status: RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED },
      });
      return NextResponse.json({ ok: true, transaction: { id: updated.id, status: updated.status } });
    }

    if (action === "dispute") {
      if (st !== RECHARGE_PROOF_STATUS.AGENT_APPROVED) {
        return NextResponse.json({ message: "لا يمكن فتح شكاية في هذه الحالة" }, { status: 400 });
      }
      const disputeMessage = String(body.disputeMessage || "").trim();
      if (disputeMessage.length < 10) {
        return NextResponse.json(
          { message: "يرجى وصف المشكلة (10 أحرف على الأقل)" },
          { status: 400 }
        );
      }
      const player = await prisma.user.findUnique({
        where: { id: session.id },
        select: { email: true },
      });
      await prisma.$transaction([
        prisma.paymentProofTransaction.update({
          where: { id: proofId },
          data: {
            status: RECHARGE_PROOF_STATUS.DISPUTED,
            disputeMessage: disputeMessage.slice(0, 8000),
          },
        }),
        prisma.complaint.create({
          data: {
            playerEmail: player?.email ?? session.id,
            subject: `شكاية شحن — طلب ${proofId}`,
            message: `معرّف الطلب: ${proofId}\nالمبلغ: ${row.amount} MAD\n\n${disputeMessage}`,
            status: "pending",
          },
        }),
      ]);
      return NextResponse.json({ ok: true, transaction: { id: proofId, status: RECHARGE_PROOF_STATUS.DISPUTED } });
    }

    if (action === "feedback") {
      if (st !== RECHARGE_PROOF_STATUS.PLAYER_CONFIRMED) {
        return NextResponse.json({ message: "التقييم متاح بعد التأكيد فقط" }, { status: 400 });
      }
      if (row.playerRating != null) {
        return NextResponse.json({ message: "تم تسجيل التقييم مسبقاً" }, { status: 400 });
      }
      const rating = body.playerRating;
      if (typeof rating !== "boolean") {
        return NextResponse.json({ message: "اختر إعجاب أو عدم إعجاب" }, { status: 400 });
      }
      const custom = String(body.playerComment || "").trim();
      const preset = String(body.predefinedComment || "").trim();
      const parts = [preset, custom].filter(Boolean);
      const playerComment = parts.join(" — ").slice(0, 4000) || (rating ? "👍" : "👎");

      const agentUserId = row.agentUserId;
      const agentProfile = await prisma.agent.findUnique({
        where: { userId: agentUserId },
        select: { id: true, rating: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.paymentProofTransaction.update({
          where: { id: proofId },
          data: {
            playerRating: rating,
            playerComment,
          },
        });
        if (rating) {
          await tx.user.update({
            where: { id: agentUserId },
            data: { likes: { increment: 1 } },
          });
          if (agentProfile) {
            const r = Math.min(5, Number(agentProfile.rating) + 0.05);
            await tx.agent.update({ where: { id: agentProfile.id }, data: { rating: r } });
          }
        } else {
          await tx.user.update({
            where: { id: agentUserId },
            data: { dislikes: { increment: 1 } },
          });
        }
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ message: "إجراء غير معروف" }, { status: 400 });
  } catch (e) {
    console.error("PATCH /api/player/transactions/[id]", e);
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
