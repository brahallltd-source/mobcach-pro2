import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

export async function GET() {
  const prisma = getPrisma();
  try {
    const agents = await prisma.agent.findMany({
      include: {
        user: {
          select: {
            username: true,
            email: true,
            status: true,
          }
        }
      }
    });
    return NextResponse.json(agents);
  } catch (error) {
    return NextResponse.json({ error: "خطأ في جلب البيانات" }, { status: 500 });
  }
}