CREATE TYPE "public"."document_type" AS ENUM('disclosure', 'promissory_note');--> statement-breakpoint
CREATE TYPE "public"."signer_role" AS ENUM('lender', 'borrower', 'co_maker');--> statement-breakpoint
CREATE TABLE "document_signatures" (
	"id" text PRIMARY KEY NOT NULL,
	"loan_id" text NOT NULL,
	"document_type" "document_type" NOT NULL,
	"signer_role" "signer_role" NOT NULL,
	"signer_name" text NOT NULL,
	"signature_data" text,
	"signed_at" timestamp,
	"ip_address" text,
	"signing_token" text,
	"token_used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_signatures_signing_token_unique" UNIQUE("signing_token")
);
--> statement-breakpoint
ALTER TABLE "document_signatures" ADD CONSTRAINT "document_signatures_loan_id_loans_id_fk" FOREIGN KEY ("loan_id") REFERENCES "public"."loans"("id") ON DELETE cascade ON UPDATE no action;