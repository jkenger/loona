CREATE TABLE "lender_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"config" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "lender_settings_lender_id_unique" UNIQUE("lender_id")
);
--> statement-breakpoint
ALTER TABLE "lender_settings" ADD CONSTRAINT "lender_settings_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;