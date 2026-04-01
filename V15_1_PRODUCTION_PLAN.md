
# V15.1 Production Start
This release starts the production migration track without breaking the current financial logic.

## Preserved financial rule
- 1000 DH recharge = 1100 DH main wallet
- Fixed 10% remains untouched
- Bonus remains separate and only applies on next recharge

## Added in V15.1
- Prisma schema scaffold
- PostgreSQL migration scaffold
- Admin crypto wallets remain under admin payment methods
- Agent -> Admin recharge flow now supports:
  - tx hash
  - proof upload
  - treasury review
  - pending bonus application on approval

## Still foundation, not cutover
- Runtime still uses JSON
- Prisma schema is ready for migration
- Next step is replacing JSON APIs with Prisma transactions incrementally
