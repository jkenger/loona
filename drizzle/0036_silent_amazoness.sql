ALTER TABLE "loans" ADD COLUMN "borrower_token" text;--> statement-breakpoint
UPDATE "loans" SET "borrower_token" = substr(replace(gen_random_uuid()::text, '-', ''), 1, 24) WHERE "borrower_token" IS NULL;--> statement-breakpoint
ALTER TABLE "loans" ADD CONSTRAINT "loans_borrower_token_unique" UNIQUE("borrower_token");