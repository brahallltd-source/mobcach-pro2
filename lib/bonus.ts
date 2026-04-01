
import { createNotification } from "@/lib/notifications";
import { creditWallet } from "@/lib/wallet";
import { dataPath, nowIso, readJsonArray, uid, writeJsonArray } from "@/lib/json";

export type AgentBonusProfile = {
  agentId: string;
  volume: number;
  energy: number;
  completed_orders: number;
  bonus_balance: number;
  pending_bonus: number;
  last_order_at: string;
  updated_at: string;
};

export type BonusLevelClaim = {
  id: string;
  agentId: string;
  level: number;
  reward: number;
  status: "claimed";
  claimed_at: string;
};

export type AgentTaskProgress = {
  id: string;
  agentId: string;
  task_key: "complete_5_orders";
  progress: number;
  target: number;
  reward: number;
  status: "tracking" | "ready" | "claimed";
  cycle: number;
  updated_at: string;
  claimed_at?: string;
};

export type PendingBonus = {
  id: string;
  agentId: string;
  source: "level" | "energy" | "task" | "referral";
  source_ref: string;
  amount: number;
  status: "pending" | "applied";
  created_at: string;
  applied_at?: string;
  meta?: Record<string, unknown>;
};

export type Referral = {
  id: string;
  player_user_id: string;
  player_email: string;
  referred_by_agent_id: string;
  first_order_reward_amount: number;
  reward_status: "none" | "pending" | "applied";
  rewarded_order_id?: string;
  created_at: string;
  updated_at: string;
};

export const BONUS_LEVELS = [
  { level: 1, target: 5000, reward: 100 },
  { level: 2, target: 10000, reward: 250 },
  { level: 3, target: 25000, reward: 600 },
] as const;

export const ENERGY_TARGET = 1000;
export const ENERGY_REWARD = 50;
export const TASK_KEY = "complete_5_orders";
export const TASK_TARGET = 5;
export const TASK_REWARD = 20;

const bonusProfilesPath = dataPath("agent_bonus_profiles.json");
const levelClaimsPath = dataPath("bonus_level_claims.json");
const taskProgressPath = dataPath("agent_task_progress.json");
const pendingBonusesPath = dataPath("pending_bonuses.json");
const referralsPath = dataPath("referrals.json");
const logsPath = dataPath("bonus_logs.json");

function log(agentId: string, action: string, meta?: Record<string, unknown>) {
  const logs = readJsonArray<any>(logsPath);
  logs.unshift({ id: uid("bonus-log"), agentId: String(agentId), action, meta: meta || {}, created_at: nowIso() });
  writeJsonArray(logsPath, logs);
}

export function getOrCreateAgentBonusProfile(agentId: string): AgentBonusProfile {
  const profiles = readJsonArray<AgentBonusProfile>(bonusProfilesPath);
  const existing = profiles.find((item) => String(item.agentId) === String(agentId));
  if (existing) return existing;
  const created: AgentBonusProfile = {
    agentId: String(agentId),
    volume: 0,
    energy: 0,
    completed_orders: 0,
    bonus_balance: 0,
    pending_bonus: 0,
    last_order_at: "",
    updated_at: nowIso(),
  };
  profiles.push(created);
  writeJsonArray(bonusProfilesPath, profiles);
  return created;
}

export function saveAgentBonusProfile(profile: AgentBonusProfile) {
  const profiles = readJsonArray<AgentBonusProfile>(bonusProfilesPath);
  const index = profiles.findIndex((item) => String(item.agentId) === String(profile.agentId));
  if (index === -1) profiles.push(profile);
  else profiles[index] = profile;
  writeJsonArray(bonusProfilesPath, profiles);
  return profile;
}

export function getTaskProgress(agentId: string) {
  const tasks = readJsonArray<AgentTaskProgress>(taskProgressPath);
  const existing = tasks.find((item) => String(item.agentId) === String(agentId) && item.task_key === TASK_KEY);
  if (existing) return existing;
  const created: AgentTaskProgress = {
    id: uid("task"),
    agentId: String(agentId),
    task_key: TASK_KEY,
    progress: 0,
    target: TASK_TARGET,
    reward: TASK_REWARD,
    status: "tracking",
    cycle: 1,
    updated_at: nowIso(),
  };
  tasks.push(created);
  writeJsonArray(taskProgressPath, tasks);
  return created;
}

function saveTask(task: AgentTaskProgress) {
  const tasks = readJsonArray<AgentTaskProgress>(taskProgressPath);
  const index = tasks.findIndex((item) => item.id === task.id);
  if (index === -1) tasks.push(task);
  else tasks[index] = task;
  writeJsonArray(taskProgressPath, tasks);
  return task;
}

export function getPendingBonuses(agentId: string) {
  return readJsonArray<PendingBonus>(pendingBonusesPath).filter((item) => String(item.agentId) === String(agentId) && item.status === "pending");
}

function addPendingBonus(agentId: string, source: PendingBonus["source"], source_ref: string, amount: number, meta?: Record<string, unknown>) {
  if (amount <= 0) return null;
  const pending = readJsonArray<PendingBonus>(pendingBonusesPath);
  const duplicate = pending.find((item) => String(item.agentId) === String(agentId) && item.source === source && item.source_ref === source_ref);
  if (duplicate) return duplicate;
  const created: PendingBonus = {
    id: uid("pending-bonus"),
    agentId: String(agentId),
    source,
    source_ref,
    amount: Number(amount),
    status: "pending",
    created_at: nowIso(),
    meta: meta || {},
  };
  pending.push(created);
  writeJsonArray(pendingBonusesPath, pending);
  const profile = getOrCreateAgentBonusProfile(agentId);
  profile.pending_bonus += Number(amount);
  profile.bonus_balance += Number(amount);
  profile.updated_at = nowIso();
  saveAgentBonusProfile(profile);
  log(agentId, "pending_bonus_created", { source, source_ref, amount });
  createNotification({
    targetRole: "agent",
    targetId: String(agentId),
    title: "Reward ready",
    message: `A bonus of ${amount} DH is now pending and will be added on your next recharge.`,
  });
  return created;
}

export function applyPendingBonusesToRecharge(agentId: string, adminEmail?: string) {
  const pending = readJsonArray<PendingBonus>(pendingBonusesPath);
  const target = pending.filter((item) => String(item.agentId) === String(agentId) && item.status === "pending");
  const total = target.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  if (total <= 0) return { totalApplied: 0, items: [] as PendingBonus[] };
  const next = pending.map((item) => target.some((p) => p.id === item.id) ? { ...item, status: "applied", applied_at: nowIso(), meta: { ...(item.meta || {}), adminEmail } } : item);
  writeJsonArray(pendingBonusesPath, next);
  const profile = getOrCreateAgentBonusProfile(agentId);
  profile.pending_bonus = 0;
  profile.updated_at = nowIso();
  saveAgentBonusProfile(profile);
  creditWallet(agentId, total, "bonus_pending_apply_on_recharge", { adminEmail, count: target.length });
  log(agentId, "pending_bonus_applied", { total, count: target.length });
  return { totalApplied: total, items: target };
}

export function recordOrderActivity(agentId: string, amount: number, orderId: string) {
  const profile = getOrCreateAgentBonusProfile(agentId);
  profile.volume += Number(amount || 0);
  profile.energy = Math.min(ENERGY_TARGET, profile.energy + Number(amount || 0) / 10);
  profile.completed_orders += 1;
  profile.last_order_at = nowIso();
  profile.updated_at = nowIso();
  saveAgentBonusProfile(profile);

  const task = getTaskProgress(agentId);
  if (task.status !== "claimed") {
    task.progress = Math.min(task.target, task.progress + 1);
    task.status = task.progress >= task.target ? "ready" : "tracking";
    task.updated_at = nowIso();
    saveTask(task);
    if (task.status === "ready") {
      createNotification({
        targetRole: "agent",
        targetId: String(agentId),
        title: "Task completed",
        message: `You completed the task: complete ${task.target} orders. Claim ${task.reward} DH in bonus.`,
      });
    }
  }

  if (profile.energy >= ENERGY_TARGET) {
    createNotification({
      targetRole: "agent",
      targetId: String(agentId),
      title: "Energy reward ready",
      message: `Your energy reached ${ENERGY_TARGET}/${ENERGY_TARGET}. Unlock your reward from the bonus page.`,
    });
  }

  log(agentId, "order_activity_recorded", { amount, orderId, volume: profile.volume, energy: profile.energy, completed_orders: profile.completed_orders });
  return { profile, task };
}

export function getLevelClaims(agentId: string) {
  return readJsonArray<BonusLevelClaim>(levelClaimsPath).filter((item) => String(item.agentId) === String(agentId));
}

export function unlockLevelReward(agentId: string, level: number) {
  const def = BONUS_LEVELS.find((item) => item.level === Number(level));
  if (!def) throw new Error("Invalid level");
  const profile = getOrCreateAgentBonusProfile(agentId);
  const claims = readJsonArray<BonusLevelClaim>(levelClaimsPath);
  if (claims.some((item) => String(item.agentId) === String(agentId) && item.level === def.level)) throw new Error("Level reward already claimed");
  if (profile.volume < def.target) throw new Error("Level target not reached");
  const claim: BonusLevelClaim = { id: uid("level-claim"), agentId: String(agentId), level: def.level, reward: def.reward, status: "claimed", claimed_at: nowIso() };
  claims.push(claim);
  writeJsonArray(levelClaimsPath, claims);
  addPendingBonus(agentId, "level", String(def.level), def.reward, { target: def.target });
  log(agentId, "level_reward_unlocked", { level: def.level, reward: def.reward });
  return claim;
}

export function unlockEnergyReward(agentId: string) {
  const profile = getOrCreateAgentBonusProfile(agentId);
  if (profile.energy < ENERGY_TARGET) throw new Error("Energy not full yet");
  const pending = readJsonArray<PendingBonus>(pendingBonusesPath);
  const existing = pending.find((item) => String(item.agentId) === String(agentId) && item.source === "energy" && item.source_ref === String(profile.last_order_at || "energy"));
  if (existing) throw new Error("Energy reward already claimed");
  addPendingBonus(agentId, "energy", String(profile.last_order_at || uid("energy")), ENERGY_REWARD, { energyTarget: ENERGY_TARGET });
  profile.energy = 0;
  profile.updated_at = nowIso();
  saveAgentBonusProfile(profile);
  log(agentId, "energy_reward_unlocked", { reward: ENERGY_REWARD });
  return { reward: ENERGY_REWARD };
}

export function claimTaskReward(agentId: string) {
  const task = getTaskProgress(agentId);
  if (task.status !== "ready") throw new Error("Task is not ready");
  addPendingBonus(agentId, "task", `${task.task_key}-${task.cycle}`, task.reward, { target: task.target, cycle: task.cycle });
  task.status = "claimed";
  task.claimed_at = nowIso();
  task.updated_at = nowIso();
  saveTask(task);
  log(agentId, "task_reward_claimed", { task: task.task_key, reward: task.reward, cycle: task.cycle });
  return task;
}

export function getReferralRows(agentId: string) {
  return readJsonArray<Referral>(referralsPath).filter((item) => String(item.referred_by_agent_id) === String(agentId));
}

export function createReferral(payload: Omit<Referral, "id" | "created_at" | "updated_at" | "reward_status" | "rewarded_order_id">) {
  const referrals = readJsonArray<Referral>(referralsPath);
  const existing = referrals.find((item) => item.player_user_id === payload.player_user_id);
  if (existing) return existing;
  const referral: Referral = {
    id: uid("ref"),
    ...payload,
    first_order_reward_amount: payload.first_order_reward_amount || 0,
    reward_status: "none",
    created_at: nowIso(),
    updated_at: nowIso(),
  };
  referrals.push(referral);
  writeJsonArray(referralsPath, referrals);
  return referral;
}

export function rewardReferralOnFirstOrder(playerEmail: string, orderId: string, amount: number) {
  const referrals = readJsonArray<Referral>(referralsPath);
  const index = referrals.findIndex((item) => item.player_email.toLowerCase() === String(playerEmail).toLowerCase());
  if (index === -1) return null;
  const referral = referrals[index];
  if (referral.reward_status !== "none") return null;
  const rewardAmount = Math.max(1, Math.floor(Number(amount || 0) * 0.02));
  referrals[index] = { ...referral, first_order_reward_amount: rewardAmount, reward_status: "pending", rewarded_order_id: orderId, updated_at: nowIso() };
  writeJsonArray(referralsPath, referrals);
  addPendingBonus(referral.referred_by_agent_id, "referral", orderId, rewardAmount, { playerEmail, percent: 2 });
  log(referral.referred_by_agent_id, "referral_reward_pending", { playerEmail, orderId, rewardAmount });
  return referrals[index];
}

export function getAgentBonusSnapshot(agentId: string) {
  const profile = getOrCreateAgentBonusProfile(agentId);
  const claims = getLevelClaims(agentId);
  const levels = BONUS_LEVELS.map((item) => {
    const claimed = claims.find((claim) => claim.level === item.level);
    return {
      level: item.level,
      name: `Level ${item.level}`,
      target: item.target,
      reward: item.reward,
      current: profile.volume,
      progress: Math.min(100, Math.round((profile.volume / item.target) * 100)),
      status: claimed ? "claimed" : profile.volume >= item.target ? "ready" : "locked",
      claimed_at: claimed?.claimed_at || "",
    };
  });
  const task = getTaskProgress(agentId);
  const referrals = getReferralRows(agentId);
  return {
    profile,
    levels,
    energy: {
      current: Math.round(profile.energy),
      target: ENERGY_TARGET,
      progress: Math.min(100, Math.round((profile.energy / ENERGY_TARGET) * 100)),
      reward: ENERGY_REWARD,
      status: profile.energy >= ENERGY_TARGET ? "ready" : "tracking",
    },
    task,
    referrals,
    pendingBonuses: getPendingBonuses(agentId),
    nextReward: levels.find((item) => item.status !== "claimed") || null,
  };
}
