CREATE TYPE "public"."advisor_alert_type" AS ENUM('payment_due_risk', 'overdue_escalation', 'loan_milestone', 'collection_rate_drop');--> statement-breakpoint
CREATE TABLE "advisor_alerts" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"type" "advisor_alert_type" NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"metadata" jsonb,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisor_alerts" ADD CONSTRAINT "advisor_alerts_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;