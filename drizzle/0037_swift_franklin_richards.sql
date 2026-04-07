CREATE TYPE "public"."luna_message_role" AS ENUM('user', 'assistant', 'tool_call', 'tool_result');--> statement-breakpoint
CREATE TABLE "lender_qr_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"label" text NOT NULL,
	"image_data" text NOT NULL,
	"show_in_emails" boolean DEFAULT true NOT NULL,
	"show_in_profile" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "luna_conversations" (
	"id" text PRIMARY KEY NOT NULL,
	"lender_id" text NOT NULL,
	"title" text,
	"last_message_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "luna_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"conversation_id" text NOT NULL,
	"role" "luna_message_role" NOT NULL,
	"content" text NOT NULL,
	"tool_name" text,
	"tool_call_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "advisor_alerts" CASCADE;--> statement-breakpoint
DROP TABLE "advisor_conversations" CASCADE;--> statement-breakpoint
DROP TABLE "advisor_messages" CASCADE;--> statement-breakpoint
DROP TABLE "advisors" CASCADE;--> statement-breakpoint
ALTER TABLE "lender_qr_codes" ADD CONSTRAINT "lender_qr_codes_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "luna_conversations" ADD CONSTRAINT "luna_conversations_lender_id_user_id_fk" FOREIGN KEY ("lender_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "luna_messages" ADD CONSTRAINT "luna_messages_conversation_id_luna_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."luna_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DROP TYPE "public"."advisor_alert_type";--> statement-breakpoint
DROP TYPE "public"."advisor_message_role";