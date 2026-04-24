import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
// ملاحظة: سنستخدم نصاً عادياً للباسورد مؤقتاً لكي تستطيع الدخول، 
// أو إذا كنت تعرف دالة التشفير في lib/security استخدمها.
const prisma = new PrismaClient();

export async function GET() {
  try {
    const admin = await prisma.user.create({
      data: {
        email: "admin@pro.com",
        username: "admin_master",
        passwordHash: "123456", // ⚠️ انتبه: إذا كان نظامك يشفر الباسورد، ستحتاج لتغييره لاحقاً
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    return NextResponse.json({ success: true, message: "تم إنشاء الآدمن بنجاح" });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message });
  }
}