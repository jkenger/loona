CREATE TYPE "public"."loan_application_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "loan_applications" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"applicant_name" text NOT NULL,
	"applicant_phone" text,
	"applicant_email" text,
	"applicant_address" text,
	"applicant_city" text,
	"requested_amount" numeric(12, 2) NOT NULL,
	"requested_term_months" integer,
	"purpose" text,
	"monthly_income" numeric(12, 2),
	"other_income" numeric(12, 2),
	"status" "loan_application_status" DEFAULT 'pending' NOT NULL,
	"reviewed_at" timestamp,
	"rejection_reason" text,
	"converted_loan_id" text,
	"form_token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loan_applications_form_token_unique" UNIQUE("form_token")
);
--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_converted_loan_id_loans_id_fk" FOREIGN KEY ("converted_loan_id") REFERENCES "public"."loans"("id") ON DELETE no action ON UPDATE no action;