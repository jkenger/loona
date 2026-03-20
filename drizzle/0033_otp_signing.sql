-- Add co-maker email to loans
ALTER TABLE "loans" ADD COLUMN "co_maker_email" text;

-- Replace signature_data with OTP fields on document_signatures
ALTER TABLE "document_signatures" DROP COLUMN "signature_data";
ALTER TABLE "document_signatures" ADD COLUMN "signer_email" text;
ALTER TABLE "document_signatures" ADD COLUMN "user_agent" text;
ALTER TABLE "document_signatures" ADD COLUMN "otp_hash" text;
ALTER TABLE "document_signatures" ADD COLUMN "otp_expires_at" timestamp;
ALTER TABLE "document_signatures" ADD COLUMN "otp_attempts" integer DEFAULT 0 NOT NULL;
ALTER TABLE "document_signatures" ADD COLUMN "otp_verified_at" timestamp;
