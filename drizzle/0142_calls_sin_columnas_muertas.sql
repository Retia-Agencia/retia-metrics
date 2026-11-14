SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_cohort_id_cohorts_id_fk";
--> statement-breakpoint
DROP INDEX "calls_cohorte_closer_idx";--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN "cohort_id";--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN "closer_id";--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN "motivo_perdida";