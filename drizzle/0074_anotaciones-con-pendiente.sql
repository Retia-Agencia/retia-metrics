SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_area_declarada_id_areas_id_fk";
--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD COLUMN "proximo_contacto" date;--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD COLUMN "pendiente_puesto" "pendiente_deal";--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "area_declarada_id";