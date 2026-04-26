-- PWA manifest theme / splash background (admin-editable).
ALTER TABLE "SystemSettings" ADD COLUMN "pwaThemeColor" TEXT NOT NULL DEFAULT '#0f172a';
ALTER TABLE "SystemSettings" ADD COLUMN "pwaBgColor" TEXT NOT NULL DEFAULT '#0f172a';
