import { getPrisma } from "./db";
import { createNotification } from "./notifications";

export const BONUS_LEVELS = [
  { level: 1, target: 5000, reward: 100 },
  { level: 2, target: 10000, reward: 250 },
  { level: 3, target: 25000, reward: 600 },
] as const;

export const ENERGY_TARGET = 1000;
export const ENERGY_REWARD = 50;

/**
 * 1. جلب أو إنشاء بروفايل البونيس (Prisma)
 */
export async function getOrCreateAgentBonusProfile(agentId: string) {
  const prisma = getPrisma();
  let profile = await prisma.agentBonusProfile.findUnique({
    where: { agentId }
  });

  if (!profile) {
    profile = await prisma.agentBonusProfile.create({
      data: {
        agentId,
        volume: 0,
        energy: 0,
        completedOrders: 0,
        pendingBonus: 0,
        bonusBalance: 0,
      }
    });
  }
  return profile;
}

/**
 * 2. تسجيل نشاط الطلب (تحديث الإحصائيات والطاقة)
 */
export async function recordOrderActivity(agentId: string, amount: number, orderId: string) {
  const prisma = getPrisma();
  const volumeIncr = Number(amount || 0);
  const energyIncr = volumeIncr / 10; // كل 10 دراهم كتعطي 1 طاقة

  const profile = await prisma.agentBonusProfile.update({
    where: { agentId },
    data: {
      volume: { increment: volumeIncr },
      energy: { increment: energyIncr },
      completedOrders: { increment: 1 },
      lastOrderAt: new Date(),
    }
  });

  // إشعار إذا وصلت الطاقة للحد الأقصى
  if (profile.energy >= ENERGY_TARGET) {
    await createNotification({
      targetRole: "agent",
      targetId: agentId,
      title: "Energy reward ready",
      message: `وصلت طاقتك إلى ${ENERGY_TARGET}. يمكنك الآن تفعيل مكافأتك!`,
    });
  }

  return profile;
}

/**
 * 3. تفعيل مكافأة المستوى (Level Reward)
 */
export async function unlockLevelReward(agentId: string, level: number) {
  const prisma = getPrisma();
  const def = BONUS_LEVELS.find((item) => item.level === Number(level));
  if (!def) throw new Error("Invalid level");

  const profile = await getOrCreateAgentBonusProfile(agentId);
  if (profile.volume < def.target) throw new Error("لم تصل للهدف المطلوب بعد");

  // التحقق هل تم استلام المكافأة سابقاً (عن طريق PendingBonus لتجنب التكرار)
  const existing = await prisma.pendingBonus.findFirst({
    where: { agentId, source: "level", sourceRef: String(level) }
  });
  if (existing) throw new Error("تم استلام مكافأة هذا المستوى مسبقاً");

  // إضافة للمكافآت المعلقة
  return await prisma.pendingBonus.create({
    data: {
      agentId,
      source: "level",
      sourceRef: String(level),
      amount: def.reward,
      status: "pending"
    }
  });
}

/**
 * 4. تفعيل مكافأة الطاقة (Energy Reward)
 */
export async function unlockEnergyReward(agentId: string) {
  const prisma = getPrisma();
  const profile = await getOrCreateAgentBonusProfile(agentId);

  if (profile.energy < ENERGY_TARGET) throw new Error("الطاقة غير كافية");

  return await prisma.$transaction(async (tx) => {
    // تصفير الطاقة في البروفايل
    await tx.agentBonusProfile.update({
      where: { agentId },
      data: { energy: 0 }
    });

    // إضافة المكافأة المعلقة
    return await tx.pendingBonus.create({
      data: {
        agentId,
        source: "energy",
        sourceRef: `energy_${Date.now()}`,
        amount: ENERGY_REWARD,
        status: "pending"
      }
    });
  });
}

/**
 * 5. تطبيق المكافآت المعلقة عند الشحن
 */
export async function applyPendingBonusesToRecharge(agentId: string, adminEmail: string) {
  const prisma = getPrisma();
  
  const pendingRewards = await prisma.pendingBonus.findMany({
    where: { agentId, status: "pending" }
  });

  if (pendingRewards.length === 0) return { totalApplied: 0 };

  const totalApplied = pendingRewards.reduce((sum, r) => sum + r.amount, 0);

  await prisma.$transaction([
    // تحديث حالة المكافآت
    prisma.pendingBonus.updateMany({
      where: { id: { in: pendingRewards.map(r => r.id) } },
      data: { status: "applied", appliedAt: new Date(), meta: { adminEmail } }
    }),
    // تصفير عداد البونيس المعلق في البروفايل
    prisma.agentBonusProfile.update({
      where: { agentId },
      data: { pendingBonus: 0 }
    })
  ]);

  return { totalApplied, count: pendingRewards.length };
}


// ============================================================================
// 🟢 6. نظام الإحالة (Referral System) - باش ما يضربش ليك الـ Build 🟢
// ============================================================================

// تأكدي من وجود كلمة export
export async function createReferral(payload: { playerUserId: string; playerEmail: string; referredByAgentId: string }) {
  const prisma = getPrisma();
  return await prisma.referral.create({
    data: {
      playerUserId: payload.playerUserId,
      playerEmail: payload.playerEmail,
      referredByAgentId: payload.referredByAgentId,
      rewardStatus: "PENDING",
    }
  });
}

export async function rewardReferralOnFirstOrder(playerEmail: string, orderId: string, amount: number) {
  const prisma = getPrisma();
  const ref = await prisma.referral.findFirst({
    where: { playerEmail, rewardStatus: "PENDING" }
  });
  
  if (ref) {
    const reward = amount * 0.05; // 5% من أول شحن كبونيس للوكيل
    
    await prisma.referral.update({
      where: { id: ref.id },
      data: {
        rewardStatus: "COMPLETED",
        firstOrderReward: reward,
        rewardedOrderId: orderId
      }
    });
  }
}

export async function getReferralRows(agentId: string) {
  const prisma = getPrisma();
  return await prisma.referral.findMany({
    where: { referredByAgentId: agentId },
    orderBy: { createdAt: "desc" }
  });
}