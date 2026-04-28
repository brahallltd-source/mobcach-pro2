import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  customWorkerSrc: "worker",
  buildExcludes: [/middleware-manifest\.json$/],
  // Prevent worker minification hangs during build (terser/renderChunk).
  minify: false,
  /** Precache + front-end nav cache can surprise auth-heavy apps; keep off unless you tune runtimeCaching. */
  cacheOnFrontEndNav: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }]
  },
  async redirects() {
    return [
      { source: "/agent/requests", destination: "/agent/add-requests", permanent: false },
      { source: "/agent/requests-history", destination: "/agent/add-requests", permanent: false },
      { source: "/agent/orders", destination: "/agent/add-requests", permanent: false },
      { source: "/agent/activations", destination: "/agent/add-requests", permanent: false },
      { source: "/agent/recharge", destination: "/agent/gosport365-topup", permanent: false },
      { source: "/agent/recharge/history", destination: "/agent/gosport365-topup", permanent: false },
      { source: "/agent/recharge-from-admin", destination: "/agent/balance-topup-requests", permanent: false },
      { source: "/agent/transactions", destination: "/agent/player-recharge-requests", permanent: false },
      { source: "/agent/withdrawals", destination: "/agent/all-history", permanent: false },
      { source: "/agent/invites", destination: "/agent/invitations-rewards", permanent: false },
      { source: "/agent/invite-agent", destination: "/agent/invitations-rewards", permanent: false },
      { source: "/agent/bonus", destination: "/agent/invitations-rewards", permanent: false },
      { source: "/agent/winner-requests", destination: "/agent/all-history", permanent: false },
    ];
  },
};

export default withPWA(nextConfig);
