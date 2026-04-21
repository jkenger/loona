CREATE TYPE "public"."cash_transaction_type" AS ENUM('deposit', 'expense');--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE 'draft' BEFORE 'pending_disbursement';--> statement-breakpoint
CREATE TABLE "cash_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"type" "cash_transaction_type" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"description" text NOT NULL,
	"transaction_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cash_transactions" ADD CONSTRAINT "cash_transactions_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;