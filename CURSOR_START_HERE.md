
# GS365Cash V17.1 — Cursor Ready Package

## What is this package?
This archive is prepared so you can open it directly in Cursor and continue rebuilding the product cleanly.

## Recommended first steps in Cursor
1. Open this folder in Cursor.
2. Run:
   ```bash
   npm install
   npm run dev
   ```
3. If you want Prisma enabled:
   ```bash
   npx prisma generate
   npx prisma migrate dev
   npm run db:import
   npm run security:rehash
   ```

## Rebuild priority for V17.1
### 1. Core architecture cleanup
- Remove mixed logic between JSON and Prisma in critical flows
- Standardize statuses across UI / API / DB
- Keep wallet logic protected and unchanged:
  - 1000 DH recharge => 1100 DH fixed
  - bonus wallet remains separate

### 2. Player flow
- Separate `New Order` from `Orders`
- Hide agent balance from players
- Keep chat open on order thread
- Fix final player approval after agent approval

### 3. Agent flow
- Fix `Invite an Agent`
- Fix `Add a Player`
- When agent adds a player:
  - create player account immediately
  - link directly to that agent
  - generate copyable credentials message

### 4. Admin flow
- Agent application review stable
- Approval should:
  - approve account
  - create wallet
  - generate official copyable message

### 5. Winnings
- Rebuild player winnings page
- Payout request flow
- Notifications for agent + admin
- History page

### 6. Languages
- Unify Arabic / French / English dictionaries
- Remove mixed labels inside same page

## Important note
This package is intended as a Cursor-ready working baseline for the V17.1 rebuild.
