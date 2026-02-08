ALTER TABLE "agents" ALTER COLUMN "tier" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "agents" ALTER COLUMN "tier" DROP NOT NULL;--> statement-breakpoint
UPDATE "agents" SET "tier" = NULL WHERE "tier" IS NOT NULL;