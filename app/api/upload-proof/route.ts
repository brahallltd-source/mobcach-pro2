import { NextResponse } from "next/server";
import crypto from "crypto";
import { getPrisma } from "@/lib/db"; // تأكد من مسار جلب prisma
import { ensureCloudinaryConfigured } from "@/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    if (!prisma) throw new Error("Database unavailable");

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const orderId = String(formData.get("orderId") || "").trim();
    const paymentMethodName = String(formData.get("paymentMethodName") || "").trim();

    // 1. التحقق من البيانات
    if (!file || !orderId) {
      return NextResponse.json({ message: "Order ID and File are required" }, { status: 400 });
    }

    // 2. معالجة الصورة وحساب الـ Hash (لمنع التكرار/الاحتيال)
    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");

    // 3. الرفع إلى Cloudinary
    const cloudinary = ensureCloudinaryConfigured();
    const base64 = `data:${file.type};base64,${buffer.toString("base64")}`;
    const uploadResult = await cloudinary.uploader.upload(base64, {
      folder: "gosport/proofs",
    });

    // 4. تحديث الطلب في قاعدة البيانات (انتقال للمرحلة الثانية)
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: {
        status: "proof_uploaded", // تحديث الحالة لخريطة المراحل
        proofUrl: uploadResult.secure_url,
        proofHash: hash,
        paymentMethodName: paymentMethodName,
        updatedAt: new Date(),
      },
    });

    // 5. إضافة رسالة تلقائية في الشات لإعلام الوكيل
    await prisma.orderMessage.create({
      data: {
        orderId: orderId,
        senderRole: "system",
        message: `✅ قام اللاعب برفع إثبات التحويل عبر: ${paymentMethodName}. في انتظار مراجعة الوكيل.`,
      },
    });

    // 6. التحقق من تكرار الـ Hash (Fraud Check)
    const duplicate = await prisma.order.findFirst({
      where: {
        proofHash: hash,
        id: { not: orderId }, // البحث في غير هذا الطلب
      },
    });

    if (duplicate) {
      // إذا وجدنا تكرار، نقوم بعمل Flag للطلب تلقائياً
      await prisma.order.update({
        where: { id: orderId },
        data: {
          reviewRequired: true,
          reviewReason: "duplicate_proof_hash_detected",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "Proof uploaded and order updated ✅",
      proofUrl: uploadResult.secure_url,
      status: updatedOrder.status
    });

  } catch (error: any) {
    console.error("UPLOAD & UPDATE ERROR:", error);
    return NextResponse.json({ 
      message: "حدث خطأ أثناء تحديث الطلب، يرجى المحاولة مرة أخرى." 
    }, { status: 500 });
  }
}