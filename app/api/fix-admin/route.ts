import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // تأكد أن المسار صحيح لملف Prisma لديك

export async function GET() {
  try {
    // 1. البحث عن أول مستخدم في قاعدة البيانات مهما كان إيميله
    const firstUser = await prisma.user.findFirst();

    if (!firstUser) {
      return NextResponse.json({ 
        success: false, 
        message: "قاعدة البيانات فارغة تماماً! يرجى الذهاب لصفحة التسجيل (Register) وإنشاء حساب جديد أولاً." 
      });
    }

    // 2. إصلاح وترقية هذا المستخدم ليصبح مديراً عاماً
    const updatedUser = await prisma.user.update({
      where: { id: firstUser.id },
      data: {
        permissions: [], // تنظيف الحقل التالف
        role: "SUPER_ADMIN" // ترقية قسرية لمدير عام
      }
    });

    return NextResponse.json({ 
      success: true, 
      message: `🎉 تم إصلاح وترقية الحساب بنجاح! يمكنك الآن تسجيل الدخول.`,
      fixedEmail: updatedUser.email // سيعرض لك الإيميل الذي تم إصلاحه
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: "Failed to fix", 
      details: error.message 
    });
  }
}