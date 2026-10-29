SET lock_timeout = '5s';--> statement-breakpoint
DROP INDEX "piezas_permanente_idx";--> statement-breakpoint
ALTER TABLE "piezas" ALTER COLUMN "red" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "piezas_permanente_idx" ON "piezas" USING btree ("creador_id",(coalesce("red", ''))) WHERE "piezas"."permanente" AND "piezas"."anulado_en" IS NULL;--> statement-breakpoint
ALTER TABLE "piezas" ADD CONSTRAINT "piezas_red_o_permanente" CHECK ("piezas"."red" IS NOT NULL OR "piezas"."permanente");