ALTER TABLE "calls" ADD COLUMN "calendly_host_email" text;--> statement-breakpoint
ALTER TABLE "miembros_programa" ADD COLUMN "calendly_email" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "calendly_signing_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "miembros_programa_calendly_idx" ON "miembros_programa" USING btree ("program_id",lower("calendly_email")) WHERE "miembros_programa"."calendly_email" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_crm_con_deal" CHECK ("calls"."deal_id" IS NOT NULL OR "calls"."origen" <> 'crm');