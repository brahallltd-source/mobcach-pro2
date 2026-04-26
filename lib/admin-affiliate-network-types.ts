export type AffiliateNetworkPlayerNode = {
  kind: "player";
  id: string;
  userId: string;
  username: string;
  email: string;
  playerStatus: string;
  isActive: boolean;
  totalSales: number;
  activePlayers: number;
  bonusesClaimed: number;
  completedOrders: number;
  totalRechargedDh: number;
  loopSuspicion: boolean;
};

export type AffiliateNetworkAgentNode = {
  kind: "master_agent" | "sub_agent";
  id: string;
  userId: string;
  agentProfileId: string;
  displayName: string;
  username: string;
  email: string;
  referredById: string | null;
  totalSales: number;
  activePlayers: number;
  bonusesClaimed: number;
  downstreamLoopingPlayers: number;
  hasLoopRisk: boolean;
  children: (AffiliateNetworkAgentNode | AffiliateNetworkPlayerNode)[];
};
