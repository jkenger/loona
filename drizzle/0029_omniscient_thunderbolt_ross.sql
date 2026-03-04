CREATE TYPE "public"."advisor_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TABLE "advisor_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"advisor_id" text NOT NULL,
	"lender_id" text NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" "advisor_message_role" NOT NULL,
	"content" text NOT NULL,
	"metadata" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisors" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"name" text DEFAULT 'Advisor' NOT NULL,
	"system_prompt" text,
	"model" text DEFAULT 'claude-sonnet-4-20250514' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisor_conversations" ADD CONSTRAINT "advisor_conversations_advisor_id_advisors_id_fk" FOREIGN KEY ("advisor_id") REFERENCES "public"."advisors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_conversations" ADD CONSTRAINT "advisor_conversations_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_messages" ADD CONSTRAINT "advisor_messages_conversation_id_advisor_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."advisor_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisors" ADD CONSTRAINT "advisors_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;