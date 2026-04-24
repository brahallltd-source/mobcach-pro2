import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

/** After `prisma generate`, old cached clients may not expose new delegates (e.g. `notification` / `auditLog`), which crashes on `.findMany`. */
function isStalePrismaClient(client: PrismaClient): boolean {
  return (
    typeof (client as unknown as { notification?: unknown }).notification ===
      "undefined" ||
    typeof (client as unknown as { auditLog?: unknown }).auditLog === "undefined"
  );
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

  if (global.prismaGlobal && isStalePrismaClient(global.prismaGlobal)) {
    void global.prismaGlobal.$disconnect().catch(() => {});
    global.prismaGlobal = undefined;
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