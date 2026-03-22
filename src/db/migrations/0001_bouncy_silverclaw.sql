ALTER TABLE "jobs" ADD COLUMN "retry_count" text DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "last_error" text;