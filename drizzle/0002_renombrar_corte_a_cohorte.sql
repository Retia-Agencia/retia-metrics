ALTER TYPE "public"."estado_corte" RENAME TO "estado_cohorte";--> statement-breakpoint
ALTER TABLE "cohorts" RENAME COLUMN "trm_corte" TO "trm_cohorte";
