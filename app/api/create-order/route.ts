import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import {
  type AgentPaymentMethodRow,
  parseAgentPaymentMethodsJson,
  toPublicPaymentMethodPayload,
} from "@/lib/agent-payment-settings";
import crypto from "node:crypto";

export const runtime = "nodejs";

function sha256(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json(
        { message: "Database not available" },
        { status: 500 }
      );
    }

    const body = await req.json();
    console.log("CREATE ORDER BODY:", body);

    const playerEmail = String(
      body.playerEmail ||
        body.player_email ||
        body.email ||
        ""
    ).trim().toLowerCase();

    const agentId = String(body.agentId || "").trim();

    const amount = Number(body.amount || 0);

    let gosportUsername = String(
      body.gosportUsername ||
        body.gosport365Username ||
        body.gosport365_username ||
        body.gosport_username ||
        ""
    ).trim();

    const paymentMethodName = String(
      body.paymentMethodName ||
        body.payment_method_name ||
        body.methodName ||
        body.method ||
        ""
    ).trim();

    const proofUrl = String(
      body.proofUrl ||
        body.proof_url ||
        body.proof ||
        ""
    ).trim();

    const note = String(
      body.note ||
        body.notes ||
        body.message ||
        ""
    ).trim();

    const suspiciousFlags = Array.isArray(body.suspicious_flags)
      ? body.suspicious_flags.map((x: unknown) => String(x))
      : [];

    if (!playerEmail || !agentId || !amount || amount <= 0) {
      return NextResponse.json(
        { message: "playerEmail, agentId and a positive amount are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({
      where: {
        email: playerEmail,
        role: "PLAYER",
      },
    });

    if (!user) {
      return NextResponse.json(
        { message: "Player user not found" },
        { status: 404 }
      );
    }

    const player = await prisma.player.findFirst({
      where: {
        userId: user.id,
      },
    });

    if (!player) {
      return NextResponse.json(
        { message: "Player profile not found" },
        { status: 404 }
      );
    }

    if (!gosportUsername) {
      gosportUsername = String(player.gosportUsername ?? "").trim();
    }

    if (!gosportUsername) {
      return NextResponse.json(
        {
          message:
            "لم يُسجّل اسم مستخدم GoSport365 على حسابك بعد. يُفعّله الوكيل بعد التفعيل، أو تواصل معه.",
        },
        { status: 400 }
      );
    }

    const agent = await prisma.agent.findFirst({
      where: {
        id: agentId,
        status: { in: ["ACTIVE", "active", "account_created", "pending"] },
      },
      include: {
        wallet: true,
        user: { select: { paymentMethods: true } },
      },
    });

    if (!agent) {
      return NextResponse.json(
        { message: "Agent not found" },
        { status: 404 }
      );
    }

    const agentSpendable =
      agent.wallet != null
        ? Number(agent.wallet.balance)
        : Number(agent.availableBalance ?? 0);

    if (!Number.isFinite(amount) || amount > agentSpendable) {
      return NextResponse.json(
        {
          error: "Agent has insufficient balance to process this request.",
          message:
            "عذراً، رصيد الوكيل الحالي لا يغطي هذا المبلغ. اختر مبلغاً أقل أو تواصل مع الوكيل.",
        },
        { status: 400 }
      );
    }

    if (paymentMethodName) {
      const rows = parseAgentPaymentMethodsJson(agent.user?.paymentMethods);
      const hit = rows
        .filter((r) => r.isActive)
        .find(
          (r) =>
            toPublicPaymentMethodPayload(r as AgentPaymentMethodRow).methodTitle === paymentMethodName
        );
      if (hit) {
        const pub = toPublicPaymentMethodPayload(hit as AgentPaymentMethodRow);
        if (amount < pub.minAmount || amount > pub.maxAmount) {
          return NextResponse.json(
            {
              message: `المبلغ خارج حدود وسيلة الدفع (${pub.minAmount}–${pub.maxAmount} DH).`,
            },
            { status: 400 }
          );
        }
      }
    }

    const proofHash = proofUrl ? sha256(proofUrl) : null;

    let reviewRequired = false;
    let reviewReason: string | null = null;

    if (suspiciousFlags.length) {
      reviewRequired = true;
      reviewReason = suspiciousFlags.join(", ");
    }

    if (proofHash) {
      const duplicate = await prisma.order.findFirst({
        where: { proofHash },
      });

      if (duplicate) {
        reviewRequired = true;
        reviewReason = reviewReason
          ? `${reviewReason}; duplicate_proof_hash`
          : "duplicate_proof_hash";
      }
    }

    const status = reviewRequired
      ? "flagged_for_review"
      : proofUrl
      ? "proof_uploaded"
      : "pending_payment";

    const order = await prisma.order.create({
      data: {
        agentId,
        playerId: player.id,
        playerEmail,
        amount,
        gosportUsername,
        paymentMethodName: paymentMethodName || null,
        proofUrl: proofUrl || null,
        proofHash,
        reviewRequired,
        reviewReason,
        status,
        systemThread: false,
      },
      include: {
        messages: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    await prisma.orderMessage.create({
      data: {
        orderId: order.id,
        senderRole: "system",
        message: reviewRequired
          ? "Order created and flagged for review."
          : proofUrl
          ? "Order created and proof uploaded."
          : "Order created. Waiting for proof upload.",
      },
    });

    if (note) {
      await prisma.orderMessage.create({
        data: {
          orderId: order.id,
          senderRole: "player",
          message: note,
        },
      });
    }

    if (reviewRequired && reviewReason) {
      await prisma.fraudFlag.create({
        data: {
          orderId: order.id,
          type: "manual_review",
          score: 50,
          note: reviewReason,
        },
      });
    }

    createNotification({
      targetRole: "agent",
      targetId: agentId,
      title: "New order received",
      message: `${playerEmail} created a new order of ${amount} DH.`,
    });

    createNotification({
      targetRole: "player",
      targetId: user.id,
      title: "Order created",
      message: reviewRequired
        ? "Your order was created and sent for review."
        : proofUrl
        ? "Your order was created and proof uploaded successfully."
        : "Your order was created successfully.",
    });

    return NextResponse.json({
      success: true,
      message:
        status === "flagged_for_review"
          ? "Order created and flagged for review ✅"
          : status === "proof_uploaded"
          ? "Order created and proof uploaded ✅"
          : "Order submittedYour recharge request has been sent successfully. ✅",
      order: {
        ...order,
        gosport365_username: order.gosportUsername,
        payment_method_name: order.paymentMethodName,
        proof_url: order.proofUrl,
        created_at: order.createdAt,
        updated_at: order.updatedAt,
      },
    });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : `Something went wrong
We could not complete your request right now. Please try again.`,
      },
      { status: 500 }
    );
  }
}