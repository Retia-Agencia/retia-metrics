SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "opera_como_closer" boolean DEFAULT false NOT NULL;
