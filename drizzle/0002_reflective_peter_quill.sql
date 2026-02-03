ALTER TYPE "public"."payment_frequency" ADD VALUE 'semimonthly' BEFORE 'monthly';--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"user_email" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" text,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "purpose" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "collateral_description" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "co_maker_name" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "co_maker_phone" text;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "co_maker_relationship" text;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;