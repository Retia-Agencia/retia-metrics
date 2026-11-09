-- ADR 0125 (M4): el programa de una fila hija lo garantiza la base. Hoy 0 filas divergen (medido en produccion):
-- la migracion no limpia nada, endurece. Primero los UNIQUE (id, program_id) que las FK compuestas referencian,
-- despues cada FK simple se reemplaza por su compuesta en la misma transaccion (sin hueco de integridad).
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_id_programa_uq" UNIQUE("id","program_id");--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_id_programa_uq" UNIQUE("id","program_id");--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_id_programa_uq" UNIQUE("id","program_id");--> statement-breakpoint
ALTER TABLE "abonos" DROP CONSTRAINT "abonos_deal_id_deals_id_fk";--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_deal_programa_fk" FOREIGN KEY ("deal_id","program_id") REFERENCES "public"."deals"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_deal_id_deals_id_fk";--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_deal_programa_fk" FOREIGN KEY ("deal_id","program_id") REFERENCES "public"."deals"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_lead_id_leads_id_fk";--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_programa_fk" FOREIGN KEY ("lead_id","program_id") REFERENCES "public"."leads"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_cohort_id_cohorts_id_fk";--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_cohorte_programa_fk" FOREIGN KEY ("cohort_id","program_id") REFERENCES "public"."cohorts"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_meta" DROP CONSTRAINT "eventos_meta_deal_id_deals_id_fk";--> statement-breakpoint
ALTER TABLE "eventos_meta" ADD CONSTRAINT "eventos_meta_deal_programa_fk" FOREIGN KEY ("deal_id","program_id") REFERENCES "public"."deals"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_contactos" DROP CONSTRAINT "lead_contactos_lead_id_leads_id_fk";--> statement-breakpoint
ALTER TABLE "lead_contactos" ADD CONSTRAINT "lead_contactos_lead_programa_fk" FOREIGN KEY ("lead_id","program_id") REFERENCES "public"."leads"("id","program_id") ON DELETE cascade ON UPDATE no action;
