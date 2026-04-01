
import { PrismaClient } from "@prisma/client";

declare global {
  var __mobcash_prisma__: PrismaClient | undefined;
}

export function isDatabaseEnabled() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrisma() {
  if (!isDatabaseEnabled()) return null;
  if (!global.__mobcash_prisma__) {
    global.__mobcash_prisma__ = new PrismaClient();
  }
  return global.__mobcash_prisma__;
}
