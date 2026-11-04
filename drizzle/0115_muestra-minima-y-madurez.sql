SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "muestra_minima_conversion" integer DEFAULT 20 NOT NULL;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "dias_para_madurar" integer DEFAULT 30 NOT NULL;