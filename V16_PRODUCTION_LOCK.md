
# V16 Production Lock
This release hardens the project for the pre-launch phase.

## Added
- bcrypt password hashing for new users
- JWT session cookie (`mobcash_session`)
- middleware protection for `/admin`, `/agent`, `/player`
- logout API that clears the session cookie
- login upgraded to verify bcrypt or legacy plain passwords
- secure foundation without breaking current UX

## Important
- Existing seeded users can still log in because login supports legacy plain passwords.
- New users are now stored with hashed passwords.
- Prisma rollout from V15.2 remains compatible.

## Next step
- Re-hash seeded legacy users
- Convert more APIs from JSON fallback to Prisma-only transactions
- Add permission enforcement middleware for admin sub-roles
