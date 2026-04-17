import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { dataPath, readJsonArray } from "@/lib/json";
import { hashPassword } from "@/lib/security";

export async function GET() {
  try {
    const prisma = getPrisma();
    const legacyAgents = readJsonArray<any>(dataPath("agents.json"));
    
    let count = 0;
    for (const a of legacyAgents) {
      // 1. إنشاء المستخدم (User)
      const user = await prisma.user.upsert({
        where: { email: a.email },
        update: { role: "AGENT" },
        create: {
          username: a.username,
          email: a.email,
          passwordHash: a.passwordHash || await hashPassword("123456"),
          role: "AGENT",
          status: "ACTIVE"
        }
      });

      // 2. إنشاء البروفايل (Agent)
      await prisma.agent.upsert({
        where: { email: a.email },
        update: { availableBalance: a.availableBalance || 0 },
        create: {
          userId: user.id,
          username: a.username,
          email: a.email,
          fullName: a.fullName || a.username,
          phone: a.phone || "0600000000",
          availableBalance: a.availableBalance || 0,
          status: "ACTIVE"
        }
      });
      count++;
    }

    return NextResponse.json({ message: `Success! Migrated ${count} agents to DB.` });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}