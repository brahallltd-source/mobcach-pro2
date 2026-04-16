import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const prisma = getPrisma();
    const { orderId, action, note } = await req.json();

    if (!orderId || !action) {
      return NextResponse.json({ message: "orderId and action are required" }, { status: 400 });
    }

    // 1. قلب على آخر بلاغ (Flag) تدار لهاد الطلب
    const latestFlag = await prisma.fraudFlag.findFirst({
      where: { orderId: orderId },
      orderBy: { createdAt: 'desc' }
    });

    // 2. تحديث الطلب والبلاغ في عملية واحدة (Transaction)
    const result = await prisma.$transaction(async (tx) => {
      let updatedOrder;

      if (action === "resolve") {
        // أ. تحديث حالة البلاغ إلى "محلول"
        if (latestFlag) {
          await tx.fraudFlag.update({
            where: { id: latestFlag.id },
            data: { 
              resolved: true, 
              note: `[تم الحل بواسطة الإدارة]: ${note || 'لا توجد ملاحظة'}` 
            }
          });
        }
        
        // ب. إرجاع الطلب لحالة "تم رفع الوصل" باش الوكيل يكمل خدمتو
        updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: "proof_uploaded",
            reviewRequired: false,
            reviewReason: note || "Resolved by admin fraud center",
            updatedAt: new Date()
          }
        });

      } else if (action === "reopen") {
        // أ. إعادة فتح البلاغ
        if (latestFlag) {
          await tx.fraudFlag.update({
            where: { id: latestFlag.id },
            data: { 
              resolved: false, 
              note: `[إعادة فتح البلاغ]: ${note || 'لا توجد ملاحظة'}` 
            }
          });
        }

        // ب. تجميد الطلب مرة أخرى
        updatedOrder = await tx.order.update({
          where: { id: orderId },
          data: {
            status: "flagged_for_review",
            reviewRequired: true,
            reviewReason: note || "Reopened by admin fraud center",
            updatedAt: new Date()
          }
        });
      } else {
        throw new Error("Invalid action");
      }

      return updatedOrder;
    });

    return NextResponse.json({
      success: true,
      message: action === "resolve" ? "تم حل المشكلة بنجاح" : "تم إعادة فتح المشكلة",
      order: result,
    });

  } catch (error) {
    console.error("ADMIN FRAUD REVIEW ERROR:", error);
    return NextResponse.json(
      { message: "حدث خطأ أثناء معالجة الطلب. يرجى المحاولة لاحقاً." }, 
      { status: 500 }
    );
  }
}