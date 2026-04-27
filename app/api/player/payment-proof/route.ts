import { NextResponse } from "next/server";
import { getAgentSpendableBalanceDh } from "@/lib/agent-spendable-balance";
import { getPrisma } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { ensureCloudinaryConfigured } from "@/lib/cloudinary";
import { type AgentPaymentMethodRow, parseAgentPaymentMethodsJson } from "@/lib/agent-payment-settings";
import { paymentMethodById, paymentMethodTitle } from "@/lib/constants/payment-methods";
import { RECHARGE_PROOF_STATUS } from "@/lib/recharge-proof-lifecycle";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function needsSenderPhoneForCategory(category: string | null | undefined) {
  return category === "telecom" || category === "cash";
}

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) {
      return NextResponse.json({ message: "قاعدة البيانات غير متاحة" }, { status: 503 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const playerEmail = String(formData.get("playerEmail") || "").trim().toLowerCase();
    const agentId = String(formData.get("agentId") || "").trim();
    const paymentMethodId = String(formData.get("paymentMethodId") || "").trim();
    const requestedAmount = Number(String(formData.get("amount") || "").trim().replace(",", "."));
    const senderName = String(formData.get("senderName") || "").trim();
    const senderPhone = String(formData.get("senderPhone") || "").trim();

    if (!playerEmail || !agentId || !paymentMethodId) {
      return NextResponse.json({ message: "بيانات ناقصة" }, { status: 400 });
    }
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json({ message: "المبلغ غير صالح" }, { status: 400 });
    }
    if (senderName.length < 2 || senderName.length > 200) {
      return NextResponse.json({ message: "الاسم الكامل غير صالح" }, { status: 400 });
    }

    const catalog = paymentMethodById(paymentMethodId);
    if (!catalog) {
      return NextResponse.json({ message: "وسيلة الدفع غير معروفة" }, { status: 400 });
    }
    const category = catalog.category;
    const phoneRequired = needsSenderPhoneForCategory(category);
    if (phoneRequired && (!senderPhone || senderPhone.length < 6)) {
      return NextResponse.json(
        { message: "رقم الهاتف مطلوب لهذه الوسيلة" },
        { status: 400 }
      );
    }

    if (!file) {
      return NextResponse.json({ message: "صورة الإثبات مطلوبة" }, { status: 400 });
    }
    if (!file.type.startsWith("image/")) {
      return NextResponse.json({ message: "يُسمح بملفات الصور فقط" }, { status: 400 });
    }
    if (file.size > 8 * 1024 * 1024) {
      return NextResponse.json({ message: "حجم الصورة كبير جداً (الحد 8 ميغابايت)" }, { status: 400 });
    }

    const playerUser = await prisma.user.findFirst({
      where: { email: playerEmail, role: "PLAYER" },
    });
    if (!playerUser) {
      return NextResponse.json({ message: "لاعب غير موجود" }, { status: 404 });
    }

    const agentProfile = await prisma.agent.findFirst({
      where: {
        id: agentId,
        status: { in: ["ACTIVE", "active", "account_created", "pending"] },
      },
      include: {
        user: { select: { id: true, paymentMethods: true } },
        wallet: true,
      },
    });
    if (!agentProfile?.user?.id) {
      return NextResponse.json({ message: "الوكيل غير متاح" }, { status: 404 });
    }

    const methods = parseAgentPaymentMethodsJson(agentProfile.user.paymentMethods);
    const methodRow = methods.find((m) => m.id === paymentMethodId && m.isActive) as
      | AgentPaymentMethodRow
      | undefined;
    if (!methodRow) {
      return NextResponse.json({ message: "وسيلة الدفع غير مفعّلة لهذا الوكيل" }, { status: 400 });
    }

    const minA = Number(methodRow.min_amount);
    const maxA = Number(methodRow.max_amount);
    if (Number.isFinite(minA) && Number.isFinite(maxA) && minA > 0 && maxA > 0) {
      if (Number(requestedAmount) < Number(minA) || Number(requestedAmount) > Number(maxA)) {
        return NextResponse.json(
          { message: `المبلغ يجب أن يكون بين ${Math.round(minA)} و ${Math.round(maxA)} MAD` },
          { status: 400 }
        );
      }
    }

    const agentBal = getAgentSpendableBalanceDh(agentProfile);
    console.log("Validating Deposit -> Requested:", requestedAmount, "Agent Balance:", agentBal);
    if (!Number.isFinite(requestedAmount) || !Number.isFinite(agentBal) || requestedAmount > agentBal) {
      return NextResponse.json(
        {
          message:
            "عذراً، رصيد الوكيل الحالي لا يكفي لهذا المبلغ. جرّب مبلغاً أصغر أو تواصل مع الوكيل.",
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const cloudinary = ensureCloudinaryConfigured();
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
    const uploadResult = await cloudinary.uploader.upload(base64, {
      folder: "mobcash/player-payment-proofs",
      resource_type: "image",
    });
    const receiptUrl = String(uploadResult.secure_url || "");

    const methodTitle = paymentMethodTitle(methodRow.id);

    const now = new Date();
    const row = await prisma.paymentProofTransaction.create({
      data: {
        amount: requestedAmount,
        senderName,
        senderPhone: senderPhone || null,
        receiptUrl,
        status: RECHARGE_PROOF_STATUS.PROCESSING,
        paymentMethodId,
        paymentMethodTitle: methodTitle,
        paymentMethod: methodTitle,
        timerStartedAt: now,
        agentUserId: agentProfile.user.id,
        playerUserId: playerUser.id,
      },
    });

    await createNotification({
      userId: agentProfile.user.id,
      title: "إثبات دفع جديد",
      message: `اللاعب ${playerUser.username || playerUser.email} أرسل إثبات تحويل بمبلغ ${requestedAmount} MAD (${methodTitle}).`,
      type: "RECHARGE_REQUEST",
      link: "/agent/notifications",
    });

    return NextResponse.json({
      ok: true,
      id: row.id,
      message: "تم تسجيل الطلب",
    });
  } catch (e: unknown) {
    console.error("PLAYER PAYMENT PROOF:", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("Cloudinary")) {
      return NextResponse.json(
        { message: "تعذّر رفع الصورة. تحقق من إعدادات التخزين السحابي." },
        { status: 503 }
      );
    }
    return NextResponse.json({ message: "حدث خطأ غير متوقع" }, { status: 500 });
  }
}
