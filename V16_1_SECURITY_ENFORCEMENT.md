
# V16.1 Security Enforcement
This release continues the production lock phase.

## Added
- backend admin permission enforcement on selected sensitive admin APIs
- session-based admin permission checks via `mobcash_session`
- `security:rehash` script for legacy seeded passwords
- runtime support for keeping old users until explicit rehash

## Protected admin API groups
- admin users
- admin payment methods
- admin topup agent
- admin topup requests
- admin agent applications
- admin update agent application

## Run after install
npm install
npm run security:rehash

## Result
- old plain passwords are replaced with bcrypt hashes in `data/users.json`
- admin sub-role permissions are enforced server-side for key operations
