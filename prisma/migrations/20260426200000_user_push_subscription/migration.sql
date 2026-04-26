-- Web Push: store PushSubscription JSON on User (re-subscribe overwrites).
ALTER TABLE "User" ADD COLUMN "pushSubscription" JSONB;
