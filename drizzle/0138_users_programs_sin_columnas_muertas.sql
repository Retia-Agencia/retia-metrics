SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "record_personas_por_dia_habil";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "calendly_email";