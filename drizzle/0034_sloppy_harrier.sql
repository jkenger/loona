CREATE TABLE "loan_restructures" (
	"id" text PRIMARY KEY NOT NULL,
	"loan_id" text NOT NULL,
	"created_by_id" text NOT NULL,
	"previous_remaining_balance" numeric(12, 2) NOT NULL,
	"balance_reduction" numeric(12, 2) DEFAULT '0' NOT NULL,
	"new_remaining_balance" numeric(12, 2) NOT NULL,
	"additional_months" integer DEFAULT 0 NOT NULL,
	"new_payment_amount" numeric(12, 2) NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "restructure_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD COLUMN "reminder_before_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD COLUMN "reminder_on_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD COLUMN "reminder_after_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "payment_schedule" ADD COLUMN "restructured_at" timestamp;--> statement-breakpoint
ALTER TABLE "loan_restructures" ADD CONSTRAINT "loan_restructures_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_restructures" ADD CONSTRAINT "loan_restructures_created_by_id_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;