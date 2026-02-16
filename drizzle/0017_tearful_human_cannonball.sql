CREATE TABLE "playbook_sections" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"section_key" text NOT NULL,
	"content" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "unique_lender_section" UNIQUE("lender_id","section_key")
);
--> statement-breakpoint
ALTER TABLE "playbook_sections" ADD CONSTRAINT "playbook_sections_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;