
# V15.2 Prisma Rollout
This version starts real runtime Prisma support with JSON fallback.

## Runtime routes migrated first
- /api/login
- /api/register-player
- /api/agent/wallet
- /api/admin/topup-agent

## Strategy
- If DATABASE_URL exists -> Prisma path
- Else -> JSON fallback remains active

## Added
- lib/db.ts
- lib/wallet-db.ts
- scripts/import-json-to-prisma.mjs

## Important
Financial rule remains unchanged:
- 1000 DH -> 1100 DH fixed
- pending bonus remains separate and applied only on next recharge
