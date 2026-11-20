ALTER TABLE "cohorts" DROP CONSTRAINT "cohorts_activa_con_inicio_ventas";--> statement-breakpoint
ALTER TABLE "cohorts" DROP CONSTRAINT "cohorts_definida_si_no_es_futura";--> statement-breakpoint
DROP INDEX "cohorts_una_activa_por_programa_idx";--> statement-breakpoint
ALTER TABLE "cohorts" DROP COLUMN "estado";--> statement-breakpoint
DROP TYPE "public"."estado_cohorte";