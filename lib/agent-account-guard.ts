import { UserAccountStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import type { PrismaClient } from "@prisma/client";
import { getOrCreateSystemSettings } from "@/lib/system-settings";

/** 403 body for frozen / suspended agent accounts (recharge, add-player, etc.). */
export const ACCOUNT_SUSPENDED_AR = "حسابك مجمد، يرجى الاتصال بالإدارة";

/** 403 when platform maintenance blocks agent actions. */
export const MAINTENANCE_BLOCK_AR =
  "المنصّة في وضع الصيانة حالياً. لا يمكن تنفيذ هذا الإجراء، يرجى المحاولة لاحقاً.";

export function isUserSuspended(accountStatus: UserAccountStatus, frozen: boolean): boolean {
  return accountStatus === UserAccountStatus.SUSPENDED || frozen === true;
}

/** @returns NextResponse to return early, or `null` if OK */
export async function rejectAgentIfSuspended(
  prisma: PrismaClient,
  userId: string
): Promise<NextResponse | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { accountStatus: true, frozen: true },
  });
  if (!row) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }
  if (isUserSuspended(row.accountStatus, row.frozen)) {
    return NextResponse.json({ success: false, message: ACCOUNT_SUSPENDED_AR }, { status: 403 });
  }
  return null;
}

/** @returns NextResponse to return early, or `null` if OK */
export async function rejectIfMaintenanceBlocksAgents(
  prisma: PrismaClient
): Promise<NextResponse | null> {
  const s = await getOrCreateSystemSettings(prisma);
  if (s.isMaintenance) {
    return NextResponse.json({ success: false, message: MAINTENANCE_BLOCK_AR }, { status: 403 });
  }
  return null;
}
