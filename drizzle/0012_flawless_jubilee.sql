ALTER TABLE "payments" ADD COLUMN "reversed_at" timestamp;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversed_by" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "reversal_reason" text;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_reversed_by_user_id_fk" FOREIGN KEY ("reversed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;