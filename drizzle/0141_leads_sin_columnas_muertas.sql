SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "leads" DROP CONSTRAINT "leads_cohort_id_cohorts_id_fk";
--> statement-breakpoint
DROP INDEX "leads_programa_estado_idx";--> statement-breakpoint
DROP INDEX "leads_cohorte_idx";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "cargo";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "empresa";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "ciudad";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "pais";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "ingreso_declarado";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "urgencia";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "por_que_aplico";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "estado";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "motivo_descarte";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "cohort_id";--> statement-breakpoint
ALTER TABLE "leads" DROP COLUMN "raw";