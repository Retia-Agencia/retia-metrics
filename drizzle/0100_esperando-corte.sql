-- 293: Esperando corte. Columna nullable y un CHECK sobre deals (tabla caliente). Medido el 21-oct:
-- 0 deals con el pendiente proxima_cohorte, asi que el CHECK no tiene datos que arreglar.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "cohorte_destino_texto" text;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_esperando_corte_con_texto" CHECK (("deals"."cohorte_destino_texto" IS NULL OR "deals"."pendiente" = 'proxima_cohorte')
          AND ("deals"."pendiente" IS DISTINCT FROM 'proxima_cohorte' OR "deals"."cohorte_destino_id" IS NOT NULL
               OR length(trim("deals"."cohorte_destino_texto")) > 0));