import { hasPermission, normalizeStoredPermissions, type PermissionId } from "@/lib/permissions";

export type { PermissionId } from "@/lib/permissions";
export {
  PERMISSIONS,
  normalizeStoredPermissions,
  isValidPermissionId,
  defaultPermissionsForNewAdmin,
} from "@/lib/permissions";

export function isSuperAdminRole(role: string | null | undefined): boolean {
  return String(role ?? "").trim().toUpperCase() === "SUPER_ADMIN";
}

export function isAdminRole(role: string | null | undefined): boolean {
  const u = String(role ?? "").trim().toUpperCase();
  return u === "ADMIN" || u === "SUPER_ADMIN";
}

/** Effective permission ids for an admin row (legacy keys expanded). Never throws on null / string / non-array. */
export function parseAdminPermissions(raw: unknown): PermissionId[] {
  return normalizeStoredPermissions(raw);
}

export function hasAdminPermission(effective: PermissionId[], permission: PermissionId): boolean {
  return hasPermission(effective, permission);
}
