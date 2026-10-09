SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "motivos" ADD COLUMN "pide_texto" boolean DEFAULT false NOT NULL;