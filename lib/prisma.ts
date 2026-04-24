import { PrismaClient } from "@prisma/client";

// لمنع فتح اتصالات متعددة أثناء عمل Hot Reload في التطوير
// Prefer `getPrisma()` from `@/lib/db` for the canonical singleton and stale-client handling.
const globalForPrisma = global as unknown as { prisma: PrismaClient | undefined };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ["query"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
