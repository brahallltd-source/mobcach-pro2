import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: true,
  register: true,
  skipWaiting: true,
  // Avoid persisting stale startup HTML between deployments.
  cacheStartUrl: false,
  dynamicStartUrl: false,
  customWorkerSrc: "worker",
  buildExcludes: [/middleware-manifest\.json$/],
  // Prevent worker minification hangs during build (terser/renderChunk).
  minify: false,
  /** Precache + front-end nav cache can surprise auth-heavy apps; keep off unless you tune runtimeCaching. */
  cacheOnFrontEndNav: false,
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ["whatsapp-web.js", "got-scraping", "header-generator", "fingerprint-generator"],
  trailingSlash: false,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }]
  },
  async redirects() {
    return [
      { source: "/download", destination: "/", permanent: false },
      { source: "/download/:path*", destination: "/", permanent: false },
      { source: "/dow", destination: "/", permanent: false },
      { source: "/dow/:path*", destination: "/", permanent: false },
      { source: "/index.html", destination: "/", permanent: false },
      { source: "/home.html", destination: "/", permanent: false },
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
  async headers() {
    return [
      {
        source: "/downloads/:file*.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="GS365CASH.apk"' },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
      {
        source: "/:file*.apk",
        headers: [
          { key: "Content-Type", value: "application/vnd.android.package-archive" },
          { key: "Content-Disposition", value: 'attachment; filename="GS365CASH.apk"' },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },
};

export default withPWA(nextConfig);
