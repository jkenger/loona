CREATE TYPE "public"."payment_type" AS ENUM('credit', 'debit');--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "type" "payment_type" DEFAULT 'credit' NOT NULL;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reverses_payment_id" text;