
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const dataDir = path.join(process.cwd(), "data");

function read(file) {
  const p = path.join(dataDir, file);
  if (!fs.existsSync(p)) return [];
  const txt = fs.readFileSync(p, "utf8").trim();
  return txt ? JSON.parse(txt) : [];
}

async function main() {
  const users = read("users.json");
  const players = read("players.json");
  const agents = read("agents.json");
  const wallets = read("agent_wallets.json");
  const adminMethods = read("admin_payment_methods.json");
  const activations = read("activations.json");
  const orders = read("orders.json");

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        username: user.username || user.email.split("@")[0],
        passwordHash: user.password || "123456",
        role: String(user.role || "player").toUpperCase(),
        playerStatus: user.player_status || null,
        assignedAgentId: user.assigned_agent_id || null,
        agentId: user.agentId || null,
        permissions: user.permissions || undefined,
      },
      create: {
        email: user.email,
        username: user.username || user.email.split("@")[0],
        passwordHash: user.password || "123456",
        role: String(user.role || "player").toUpperCase(),
        playerStatus: user.player_status || null,
        assignedAgentId: user.assigned_agent_id || null,
        agentId: user.agentId || null,
        permissions: user.permissions || undefined,
      },
    });
  }

  for (const agent of agents) {
    await prisma.agent.upsert({
      where: { id: String(agent.id) },
      update: {
        fullName: agent.full_name || `${agent.first_name || ""} ${agent.last_name || ""}`.trim(),
        username: agent.username || String(agent.email || "").split("@")[0],
        email: agent.email,
        phone: agent.phone || "",
        country: agent.country || null,
        status: agent.status || "pending_agent_review",
        referralCode: agent.referral_code || null,
        online: Boolean(agent.online),
        note: agent.note || null,
      },
      create: {
        id: String(agent.id),
        fullName: agent.full_name || `${agent.first_name || ""} ${agent.last_name || ""}`.trim(),
        username: agent.username || String(agent.email || "").split("@")[0],
        email: agent.email,
        phone: agent.phone || "",
        country: agent.country || null,
        status: agent.status || "pending_agent_review",
        referralCode: agent.referral_code || null,
        online: Boolean(agent.online),
        note: agent.note || null,
      },
    });
  }

  for (const player of players) {
    const user = users.find((u) => u.id === player.user_id);
    if (!user) continue;
    await prisma.player.upsert({
      where: { userId: user.id },
      update: {
        firstName: player.first_name || "",
        lastName: player.last_name || "",
        username: player.username || user.username || user.email.split("@")[0],
        phone: player.phone || "",
        city: player.city || null,
        country: player.country || null,
        dateOfBirth: player.date_of_birth || null,
        status: player.status || "inactive",
        assignedAgentId: player.assigned_agent_id || null,
        referredBy: player.referred_by || null,
      },
      create: {
        userId: user.id,
        firstName: player.first_name || "",
        lastName: player.last_name || "",
        username: player.username || user.username || user.email.split("@")[0],
        phone: player.phone || "",
        city: player.city || null,
        country: player.country || null,
        dateOfBirth: player.date_of_birth || null,
        status: player.status || "inactive",
        assignedAgentId: player.assigned_agent_id || null,
        referredBy: player.referred_by || null,
      },
    });
  }

  for (const wallet of wallets) {
    await prisma.wallet.upsert({
      where: { agentId: String(wallet.agentId) },
      update: { balance: Number(wallet.balance || 0) },
      create: { agentId: String(wallet.agentId), balance: Number(wallet.balance || 0) },
    });
  }

  for (const method of adminMethods) {
    await prisma.paymentMethod.upsert({
      where: { id: String(method.id) },
      update: {
        ownerRole: "ADMIN",
        ownerId: "admin-1",
        type: method.type,
        methodName: method.method_name,
        currency: method.currency || "MAD",
        accountName: method.account_name || null,
        rib: method.rib || null,
        walletAddress: method.wallet_address || null,
        network: method.network || null,
        phone: method.phone || null,
        feePercent: Number(method.fee_percent || 0),
      },
      create: {
        id: String(method.id),
        ownerRole: "ADMIN",
        ownerId: "admin-1",
        type: method.type,
        methodName: method.method_name,
        currency: method.currency || "MAD",
        accountName: method.account_name || null,
        rib: method.rib || null,
        walletAddress: method.wallet_address || null,
        network: method.network || null,
        phone: method.phone || null,
        feePercent: Number(method.fee_percent || 0),
      },
    });
  }

  for (const activation of activations) {
    await prisma.activation.upsert({
      where: { id: String(activation.id) },
      update: {
        agentId: String(activation.agentId),
        playerUserId: String(activation.playerUserId),
        playerEmail: activation.playerEmail,
        username: activation.username,
        passwordPlain: activation.password || activation.passwordPlain || "123456",
        whatsapp: activation.whatsapp || null,
        status: activation.status || "pending_activation",
        messageText: activation.messageText || null,
      },
      create: {
        id: String(activation.id),
        agentId: String(activation.agentId),
        playerUserId: String(activation.playerUserId),
        playerEmail: activation.playerEmail,
        username: activation.username,
        passwordPlain: activation.password || activation.passwordPlain || "123456",
        whatsapp: activation.whatsapp || null,
        status: activation.status || "pending_activation",
        messageText: activation.messageText || null,
      },
    });
  }

  for (const order of orders) {
    const player = players.find((p) => normalizeEmail(p.email || "") === normalizeEmail(order.playerEmail || "")); // noop
    await prisma.order.upsert({
      where: { id: String(order.id) },
      update: {
        agentId: String(order.agentId),
        playerEmail: String(order.playerEmail || ""),
        amount: Number(order.amount || 0),
        gosportUsername: order.gosportUsername || null,
        status: mapOrderStatus(order.status),
        paymentMethodName: order.payment_method_name || null,
        proofUrl: order.proofUrl || null,
        proofHash: order.proof_hash || null,
        reviewRequired: Boolean(order.review_required),
        reviewReason: order.review_reason || null,
        walletDeducted: Boolean(order.wallet_deducted),
      },
      create: {
        id: String(order.id),
        agentId: String(order.agentId),
        playerEmail: String(order.playerEmail || ""),
        amount: Number(order.amount || 0),
        gosportUsername: order.gosportUsername || null,
        status: mapOrderStatus(order.status),
        paymentMethodName: order.payment_method_name || null,
        proofUrl: order.proofUrl || null,
        proofHash: order.proof_hash || null,
        reviewRequired: Boolean(order.review_required),
        reviewReason: order.review_reason || null,
        walletDeducted: Boolean(order.wallet_deducted),
      },
    });
  }

  console.log("JSON import to Prisma completed.");
}

function mapOrderStatus(status) {
  const allowed = ["pending_payment","proof_uploaded","flagged_for_review","agent_approved_waiting_player","completed","cancelled","linked_waiting_first_order"];
  return allowed.includes(status) ? status : "pending_payment";
}
function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

main().finally(async () => {
  await prisma.$disconnect();
});
