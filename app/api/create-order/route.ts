import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { ensureCloudinaryConfigured } from "@/lib/cloudinary";
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

async function readPlayerGoSportId(
  prisma: NonNullable<ReturnType<typeof getPrisma>>,
  playerId: string,
  fallbackUsername: string | null | undefined,
): Promise<string> {
  const tryRead = async (column: string): Promise<string> => {
    try {
      const rows = (await prisma.$queryRawUnsafe(
        `SELECT "${column}"::text AS value FROM "Player" WHERE "id" = $1 LIMIT 1`,
        playerId,
      )) as Array<{ value?: string | null }>;
      return String(rows?.[0]?.value ?? "").trim();
    } catch {
      return "";
    }
  };

  const fromDedicated =
    (await tryRead("goSportId")) || (await tryRead("gosportId")) || (await tryRead("gosport_id"));
  if (fromDedicated) return fromDedicated;

  const fallback = String(fallbackUsername ?? "").trim();
  if (/^\d+$/.test(fallback)) return fallback;
  return "";
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

    const contentType = String(req.headers.get("content-type") || "").toLowerCase();
    const isMultipart = contentType.includes("multipart/form-data");
    let body: Record<string, unknown> = {};
    let uploadedProofUrl = "";

    if (isMultipart) {
      const form = await req.formData();
      for (const [key, value] of form.entries()) {
        if (value instanceof File) continue;
        body[key] = value;
      }
      const file = form.get("file");
      if (file instanceof File && file.size > 0) {
        const mime = String(file.type || "").toLowerCase();
        if (!(mime === "image/jpeg" || mime === "image/jpg" || mime === "image/png")) {
          return NextResponse.json({ message: "Proof image must be JPG/PNG." }, { status: 400 });
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        const cloudinary = ensureCloudinaryConfigured();
        const base64 = `data:${mime};base64,${buffer.toString("base64")}`;
        const uploadResult = await cloudinary.uploader.upload(base64, {
          folder: "mobcash/player-order-proofs",
          resource_type: "image",
        });
        uploadedProofUrl = String(uploadResult.secure_url || "").trim();
      }
    } else {
      body = (await req.json()) as Record<string, unknown>;
    }
    console.log("CREATE ORDER BODY:", body);

    const playerEmail = String(
      body.playerEmail ||
        body.player_email ||
        body.email ||
        ""
    ).trim().toLowerCase();

    const agentId = String(body.agentId || "").trim();

    const rawAmount = body.amount;
    const requested = Number(
      typeof rawAmount === "string" ? String(rawAmount).trim().replace(",", ".") : rawAmount ?? 0,
    );

    let gosportUsername = String(
      body.gosportUsername ||
        body.gosport365Username ||
        body.gosport365_username ||
        body.gosport_username ||
        ""
    ).trim();
    const submittedGoSportId = String(
      body.goSportId || body.gosportId || body.gosport_id || body.gosport365_id || "",
    ).trim();
    let goSportId = submittedGoSportId;

    const paymentMethodName = String(
      body.paymentMethodName ||
        body.payment_method_name ||
        body.methodName ||
        body.method ||
        ""
    ).trim();

    const proofUrl = String(uploadedProofUrl || body.proofUrl || body.proof_url || body.proof || "").trim();

    const note = String(
      body.note ||
        body.notes ||
        body.message ||
        ""
    ).trim();

    const suspiciousFlags = Array.isArray(body.suspicious_flags)
      ? body.suspicious_flags.map((x: unknown) => String(x))
      : typeof body.suspicious_flags === "string"
      ? String(body.suspicious_flags)
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
      : [];

    if (!playerEmail || !agentId || !Number.isFinite(requested) || requested <= 0) {
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

    if (!goSportId && /^\d+$/.test(gosportUsername)) {
      goSportId = gosportUsername;
    }
    if (!goSportId) {
      goSportId = await readPlayerGoSportId(prisma, player.id, player.gosportUsername);
    }
    if (!goSportId) {
      return NextResponse.json(
        {
          message:
            "لم يتم العثور على رقم الحساب (GoSport ID) في ملفك. يُرجى التواصل مع وكيلك لتفعيل الحساب.",
        },
        { status: 400 }
      );
    }
    if (!/^\d+$/.test(goSportId)) {
      return NextResponse.json(
        { message: "رقم الحساب (GoSport ID) غير صالح. يجب أن يكون رقمياً." },
        { status: 400 },
      );
    }
    gosportUsername = goSportId;

    // Persist manually entered legacy GoSport ID immediately on order creation.
    if (submittedGoSportId && /^\d+$/.test(submittedGoSportId)) {
      await prisma.player.update({
        where: { id: player.id },
        data: { goSportId: submittedGoSportId },
      });
    }

    const amount = requested;
    const agent = await prisma.$transaction(async (tx) => {
      // 1. Parse the amount securely
      const numericAmount = Number(amount);
      if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error("Invalid amount requested.");
      }

      // 2. Fetch agent with ALL related balance data
      const agent = await tx.agent.findUnique({
        where: { id: agentId },
        include: { 
          wallet: true,
          user: {
            include: { wallet: true } // <-- CRITICAL: Fetch the user's wallet too
          }
        }
      });

      if (!agent) {
        throw new Error("Agent not found.");
      }

      // 3. Fallback logic: Check direct wallet -> user wallet -> availableBalance
      const actualBalance = agent.wallet?.balance ?? agent.user?.wallet?.balance ?? agent.availableBalance ?? 0;

      // 4. Detailed Debug Log (Do not remove this)
      console.log("=== FINAL DEPOSIT VALIDATION DEBUG ===");
      console.log("Requested Amount:", numericAmount);
      console.log("Direct Agent Wallet Balance:", agent.wallet?.balance);
      console.log("User Wallet Balance:", agent.user?.wallet?.balance);
      console.log("Fallback availableBalance:", agent.availableBalance);
      console.log("Final Calculated Balance:", actualBalance);
      console.log("======================================");

      // 5. Validation Logic
      if (numericAmount > actualBalance) {
        throw new Error(`عذراً، رصيد الوكيل الحالي (${actualBalance} DH) لا يغطي هذا المبلغ.`);
      }
      return agent;
    });

    if (paymentMethodName) {
      const agentUser = await prisma.user.findUnique({
        where: { id: agent.userId },
        select: { paymentMethods: true },
      });
      const rows = parseAgentPaymentMethodsJson(agentUser?.paymentMethods);
      const hit = rows
        .filter((r) => r.isActive)
        .find(
          (r) =>
            toPublicPaymentMethodPayload(r as AgentPaymentMethodRow).methodTitle === paymentMethodName
        );
      if (hit) {
        const pub = toPublicPaymentMethodPayload(hit as AgentPaymentMethodRow);
        if (Number(requested) < Number(pub.minAmount) || Number(requested) > Number(pub.maxAmount)) {
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
        amount: requested,
        gosportUsername: goSportId,
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

    // Keep GoSport ID as a first-class value when optional DB columns are present.
    try {
      await prisma.$executeRaw`UPDATE "Order" SET "goSportId" = ${goSportId} WHERE "id" = ${order.id}`;
    } catch {
      try {
        await prisma.$executeRaw`UPDATE "Order" SET "gosportId" = ${goSportId} WHERE "id" = ${order.id}`;
      } catch {
        try {
          await prisma.$executeRaw`UPDATE "Order" SET "gosport_id" = ${goSportId} WHERE "id" = ${order.id}`;
        } catch {
          // Column may not exist yet.
        }
      }
    }

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

    const agentForNotify = await prisma.agent.findUnique({
      where: { id: agentId },
      select: { userId: true },
    });
    if (agentForNotify?.userId) {
      await createNotification({
        userId: agentForNotify.userId,
        title: "New order received",
        message: `${playerEmail} created a new order of ${requested} DH.`,
      });
    }

    await createNotification({
      userId: user.id,
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
        goSportId,
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