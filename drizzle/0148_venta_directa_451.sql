ALTER TYPE "public"."origen_cambio" ADD VALUE 'hotmart';--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_venta_con_dueno";--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "referencia_externa" text;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "venta_directa_en" timestamp with time zone;--> statement-breakpoint
CREATE UNIQUE INDEX "abonos_origen_referencia_externa_idx" ON "abonos" USING btree ("origen","referencia_externa") WHERE "abonos"."referencia_externa" is not null;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_venta_directa_sin_dueno" CHECK ("deals"."venta_directa_en" IS NULL OR "deals"."owner_user_id" IS NULL);--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_venta_con_dueno" CHECK ("deals"."anulado_en" IS NOT NULL OR "deals"."etapa" NOT IN ('ganado_parcial', 'ganado_completo') OR "deals"."owner_user_id" IS NOT NULL OR "deals"."huella_migracion" IS NOT NULL OR "deals"."venta_directa_en" IS NOT NULL);