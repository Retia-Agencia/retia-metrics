ALTER TABLE "submissions" ADD COLUMN "lead_quality" text;
--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "lead_value" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lead_quality" text;
--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "lead_value" text;
