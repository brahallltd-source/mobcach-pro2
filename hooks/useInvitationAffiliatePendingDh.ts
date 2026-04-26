"use client";

import { useCallback, useEffect, useState } from "react";

function computePendingDhFromStats(stats: {
  totalEarnedBonuses?: number;
  bonusesClaimed?: number;
  bonusBlockDh?: number;
}): number {
  const earned = Number(stats.totalEarnedBonuses) || 0;
  const claimed = Number(stats.bonusesClaimed) || 0;
  const blockDh = Number(stats.bonusBlockDh) || 1000;
  const pendingBlocks = Math.max(0, Math.floor(earned) - Math.floor(claimed));
  const pendingDh = pendingBlocks * blockDh;
  return Number.isFinite(pendingDh) && pendingDh > 0 ? pendingDh : 0;
}

/**
 * Pending invitation-milestone DH (same rules as invitations-rewards / server recharge).
 * Refetch after a successful top-up so the UI matches `bonusesClaimed` updates.
 */
export function useInvitationAffiliatePendingDh(enabled: boolean) {
  const [availableDh, setAvailableDh] = useState(0);

  const reload = useCallback(async () => {
    if (!enabled) {
      setAvailableDh(0);
      return;
    }
    try {
      const res = await fetch("/api/agent/invitations-rewards/stats", {
        credentials: "include",
        cache: "no-store",
      });
      if (!res.ok) {
        setAvailableDh(0);
        return;
      }
      const stats = (await res.json()) as {
        totalEarnedBonuses?: number;
        bonusesClaimed?: number;
        bonusBlockDh?: number;
      };
      setAvailableDh(computePendingDhFromStats(stats));
    } catch {
      setAvailableDh(0);
    }
  }, [enabled]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { availableDh, reload };
}
