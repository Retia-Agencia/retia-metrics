DROP INDEX "sobres_crudos_pendientes_idx";--> statement-breakpoint
ALTER TABLE "sobres_crudos" ALTER COLUMN "error" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "sobres_crudos_pendientes_idx" ON "sobres_crudos" USING btree ("source_id") WHERE "sobres_crudos"."error" is not null and "sobres_crudos"."reprocesado_en" is null;