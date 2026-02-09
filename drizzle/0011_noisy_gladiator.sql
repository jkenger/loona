CREATE TYPE "public"."penalty_status" AS ENUM('pending', 'applied', 'waived');--> statement-breakpoint
CREATE TYPE "public"."penalty_type" AS ENUM('late_fee', 'daily_interest');--> statement-breakpoint
CREATE TABLE "penalties" (
	"id" text PRIMARY KEY NOT NULL,
	"loan_id" text NOT NULL,
	"schedule_item_id" text NOT NULL,
	"penalty_type" "penalty_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"status" "penalty_status" DEFAULT 'pending' NOT NULL,
	"applied_at" timestamp,
	"waived_at" timestamp,
	"decided_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "penalty_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"config" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "penalty_settings_lender_id_unique" UNIQUE("lender_id")
);
--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_schedule_item_id_payment_schedule_id_fk" FOREIGN KEY ("schedule_item_id") REFERENCES "public"."payment_schedule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalties" ADD CONSTRAINT "penalties_decided_by_user_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "penalty_settings" ADD CONSTRAINT "penalty_settings_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;