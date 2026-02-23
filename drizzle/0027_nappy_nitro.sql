ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "tier" text;--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "on_time_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "income" numeric(12, 2);