DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'tier') THEN
    ALTER TABLE "contacts" ADD COLUMN "tier" "borrower_tier";
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'contacts' AND column_name = 'on_time_rate') THEN
    ALTER TABLE "contacts" ADD COLUMN "on_time_rate" numeric(5, 2);
  END IF;
END $$;
