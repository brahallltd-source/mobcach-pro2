
-- V15.1 initial production migration scaffold
-- Generated as a starting point for PostgreSQL + Prisma rollout.
-- Run `npx prisma migrate dev` after setting DATABASE_URL.
CREATE TABLE IF NOT EXISTS "_migration_placeholder" (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "_migration_placeholder"(id) VALUES ('v15_1_init')
ON CONFLICT (id) DO NOTHING;
