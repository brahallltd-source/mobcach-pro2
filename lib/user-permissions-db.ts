import { Prisma, type PrismaClient } from "@prisma/client";
import { normalizeStoredPermissions, type PermissionId } from "@/lib/permissions";

/**
 * Parse `permissions::text` from Postgres (text[] → `{a,b}`, or legacy JSON in column).
 * Never throws; returns a value suitable for {@link normalizeStoredPermissions}.
 */
export function parsePostgresPermissionsText(sqlText: string | null): unknown {
  if (sqlText == null) return [];
  const t = sqlText.trim();
  if (!t) return [];
  if (t.startsWith("[")) {
    try {
      return JSON.parse(t) as unknown;
    } catch {
      return [];
    }
  }
  if (t.startsWith("{") && t.endsWith("}")) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    return inner
      .split(",")
      .map((x) => x.trim().replace(/^"(.*)"$/g, "$1"))
      .filter(Boolean);
  }
  return [];
}

/** Load permissions without Prisma's String[] deserializer (avoids P2023 on bad rows). */
export async function loadUserPermissionsForAuth(
  prisma: PrismaClient,
  userId: string,
): Promise<PermissionId[]> {
  try {
    const rows = await prisma.$queryRaw<{ perms: string | null }[]>`
      SELECT permissions::text AS perms FROM "User" WHERE id = ${userId} LIMIT 1
    `;
    return normalizeStoredPermissions(parsePostgresPermissionsText(rows[0]?.perms ?? null));
  } catch (e) {
    console.error("[user-permissions-db] loadUserPermissionsForAuth", userId, e);
    return [];
  }
}

/** Batch load for admin lists (same P2023 avoidance). */
export async function loadManyUserPermissionsForAuth(
  prisma: PrismaClient,
  userIds: string[],
): Promise<Map<string, PermissionId[]>> {
  const out = new Map<string, PermissionId[]>();
  if (userIds.length === 0) return out;
  try {
    const rows = await prisma.$queryRaw<{ id: string; perms: string | null }[]>`
      SELECT id, permissions::text AS perms FROM "User" WHERE id IN (${Prisma.join(userIds)})
    `;
    for (const r of rows) {
      out.set(r.id, normalizeStoredPermissions(parsePostgresPermissionsText(r.perms)));
    }
  } catch (e) {
    console.error("[user-permissions-db] loadManyUserPermissionsForAuth", e);
  }
  for (const id of userIds) {
    if (!out.has(id)) out.set(id, []);
  }
  return out;
}
