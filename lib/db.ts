import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

function getDatabaseUrl() {
  return (
    process.env.DATABASE_URL ||
    process.env.DATABASE ||
    ""
  ).trim();
}

export function isDatabaseEnabled() {
  return Boolean(getDatabaseUrl());
}

export function getPrisma() {
  const databaseUrl = getDatabaseUrl();

  if (!databaseUrl) {
    return null;
  }

  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient({
      datasources: {
        db: {
          url: databaseUrl,
        },
      },
    });
  }

  return global.prismaGlobal;
}