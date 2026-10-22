-- 293: el CHECK de la 0100 dejaba pasar el pendiente sin destino ni texto (length(trim(NULL)) es NULL y
-- un CHECK que da NULL pasa). Lo caza tests/esperando-corte.test.ts. 0 filas afectadas al 21-oct.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_esperando_corte_con_texto";--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_esperando_corte_con_texto" CHECK (("deals"."cohorte_destino_texto" IS NULL OR "deals"."pendiente" = 'proxima_cohorte')
          AND ("deals"."pendiente" IS DISTINCT FROM 'proxima_cohorte' OR "deals"."cohorte_destino_id" IS NOT NULL
               OR coalesce(length(trim("deals"."cohorte_destino_texto")), 0) > 0));