import { PrismaClient } from "@prisma/client";

// لمنع فتح اتصالات متعددة أثناء عمل Hot Reload في التطوير
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"], // اختياري: لمشاهدة استعلامات SQL في التيرمينال
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;