SET lock_timeout = '5s';--> statement-breakpoint
-- Quita del enum `metrica_objetivo` los tres objetivos sin lector (agendas_por_dia, costo_por_lead, costo_por_venta;
-- decisión de Mani del 10-nov, ticket 403 F4). Postgres no borra un valor de un enum: se recrea el tipo. Si alguna fila
-- (en `objetivos` o en el arreglo `reportes_whatsapp.metricas`) todavía usara uno de los tres, el cast falla y toda la
-- migración se revierte: medido en producción el 10-nov, no hay ninguna (solo costo_por_agenda).
ALTER TABLE "objetivos" DROP CONSTRAINT "objetivos_moneda_de_costo_chk";--> statement-breakpoint
ALTER TABLE "reportes_whatsapp" ALTER COLUMN "metricas" DROP DEFAULT;--> statement-breakpoint
ALTER TYPE "public"."metrica_objetivo" RENAME TO "metrica_objetivo_old";--> statement-breakpoint
CREATE TYPE "public"."metrica_objetivo" AS ENUM('cupos', 'costo_por_agenda', 'roas', 'conversion_agenda_venta', 'agendas', 'inversion');--> statement-breakpoint
ALTER TABLE "objetivos" ALTER COLUMN "metrica" SET DATA TYPE "public"."metrica_objetivo" USING "metrica"::text::"public"."metrica_objetivo";--> statement-breakpoint
ALTER TABLE "reportes_whatsapp" ALTER COLUMN "metricas" SET DATA TYPE "public"."metrica_objetivo"[] USING "metricas"::text[]::"public"."metrica_objetivo"[];--> statement-breakpoint
ALTER TABLE "reportes_whatsapp" ALTER COLUMN "metricas" SET DEFAULT '{}'::"public"."metrica_objetivo"[];--> statement-breakpoint
DROP TYPE "public"."metrica_objetivo_old";--> statement-breakpoint
-- El CHECK de moneda: un costo o un presupuesto lleva moneda y una tasa no. `inversion` faltaba (el catálogo le escribe COP
-- por su unidad, `lib/catalogo/objetivos.ts:72`, y el CHECK de la 0083 solo nombraba costos): se corrige aquí.
ALTER TABLE "objetivos" ADD CONSTRAINT "objetivos_moneda_de_costo_chk" CHECK (("objetivos"."metrica" in ('costo_por_agenda', 'inversion')) = ("objetivos"."moneda" is not null));
