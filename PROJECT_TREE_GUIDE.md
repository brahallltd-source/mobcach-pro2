
# Project Tree Guide

## Pages
- `app/admin/...` => admin UI pages
- `app/agent/...` => agent UI pages
- `app/player/...` => player UI pages

## APIs
- `app/api/admin/...` => admin APIs
- `app/api/agent/...` => agent APIs
- `app/api/player/...` => player APIs

## Helpers
- `lib/...` => shared logic
- `prisma/schema.prisma` => database schema

## Safe convention
- UI page:
  - `app/admin/agents/page.tsx`
- Matching API:
  - `app/api/admin/agent-applications/route.ts`

## Rebuild rule
For V17.1, prefer:
- Prisma for core flows
- clean status mapping
- no duplicate endpoints for same purpose
