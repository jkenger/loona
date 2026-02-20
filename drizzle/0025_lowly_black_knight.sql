DO $$ BEGIN
  CREATE TYPE "public"."borrower_tier" AS ENUM('new', 'returning', 'established', 'loyal');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tier_configs" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"tier" "borrower_tier" NOT NULL,
	"interest_rate" numeric(5, 2) NOT NULL,
	"config" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lender_tier" UNIQUE("lender_id","tier")
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tier_configs" ADD CONSTRAINT "tier_configs_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;
