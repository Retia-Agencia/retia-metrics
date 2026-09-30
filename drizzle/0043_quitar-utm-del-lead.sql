SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "utm_source";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "utm_medium";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "utm_campaign";