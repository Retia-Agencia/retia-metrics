ALTER TABLE "cohorts" ADD COLUMN "meta_leads_dia" integer;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "web_url" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "calendly_url" text;--> statement-breakpoint
CREATE UNIQUE INDEX "cohorts_una_activa_por_programa_idx" ON "cohorts" USING btree ("program_id") WHERE "cohorts"."estado" = 'activo';