ALTER TYPE "public"."loan_status" ADD VALUE 'pending_approval';--> statement-breakpoint
ALTER TYPE "public"."loan_status" ADD VALUE 'rejected';--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "can_create_loans" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agents" ADD COLUMN "can_record_payments" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD COLUMN "rejection_reason" text;