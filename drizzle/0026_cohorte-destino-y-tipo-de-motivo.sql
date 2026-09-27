CREATE TYPE "public"."tipo_motivo" AS ENUM('perdida', 'reagenda', 'retroceso', 'recuperacion');--> statement-breakpoint
DROP INDEX "motivos_nombre_idx";--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "cohorte_destino_id" uuid;--> statement-breakpoint
ALTER TABLE "motivos" ADD COLUMN "tipo" "tipo_motivo" DEFAULT 'perdida' NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_cohorte_destino_id_cohorts_id_fk" FOREIGN KEY ("cohorte_destino_id") REFERENCES "public"."cohorts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "motivos_tipo_nombre_idx" ON "motivos" USING btree ("tipo",lower("nombre"));