
# V17 Localhost Test Plan

## 1) Install and run
```bash
npm install
npm run security:rehash
npm run dev
```

## 2) Optional Prisma path
```bash
npx prisma generate
npx prisma migrate dev
npm run db:import
```

## 3) Core localhost tests
- Login as admin
- Open `/admin/analytics`
- Add admin treasury crypto wallet
- Login as agent
- Create recharge request with:
  - amount
  - tx hash
  - proof upload
- Login as admin
- Review topup request
- Approve request
- Confirm:
  - main recharge applied
  - fixed 10% applied
  - pending bonus applied if any

## 4) Player flow
- Register a player
- Select an agent
- Check `/agent/activations`
- Activate and generate official message
- Create order
- Upload proof
- Confirm order lifecycle

## 5) Fraud check
- Upload same proof twice
- Confirm duplicate flag behavior
- Confirm admin notification entry
