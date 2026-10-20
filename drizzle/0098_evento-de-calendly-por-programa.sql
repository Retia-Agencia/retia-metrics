SET lock_timeout = '5s';--> statement-breakpoint
ALTER TYPE "public"."motivo_entrega" ADD VALUE 'evento_de_otro_programa';--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "calendly_event_type" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "calendly_org_compartida" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "miembros_programa_calendly_evento_idx" ON "miembros_programa" USING btree ("calendly_event_type") WHERE "miembros_programa"."calendly_event_type" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "programs_calendly_evento_idx" ON "programs" USING btree ("calendly_event_type") WHERE "programs"."calendly_event_type" IS NOT NULL;