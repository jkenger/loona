ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "penalty_id" text;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_penalty_id_penalties_id_fk" FOREIGN KEY ("penalty_id") REFERENCES "public"."penalties"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN null;
END $$;