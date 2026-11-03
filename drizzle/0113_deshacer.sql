SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."tipo_evento_reversion" AS ENUM('etapa', 'cambio');--> statement-breakpoint
CREATE TABLE "reversiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"evento_tipo" "tipo_evento_reversion" NOT NULL,
	"evento_id" uuid,
	"motivo" text,
	"user_id" uuid NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reversiones_motivo_no_vacio" CHECK ("reversiones"."motivo" IS NULL OR length(trim("reversiones"."motivo")) > 0),
	CONSTRAINT "reversiones_cambio_con_evento" CHECK ("reversiones"."evento_tipo" <> 'cambio' OR "reversiones"."evento_id" IS NOT NULL)
);
--> statement-breakpoint
ALTER TABLE "abonos" DROP CONSTRAINT "abonos_anulacion_completa";--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_anulacion_completa";--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_anulacion_completa";--> statement-breakpoint
ALTER TABLE "change_log" ADD COLUMN "reversion_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD COLUMN "anulado_en" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD COLUMN "anulado_por" uuid;--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD COLUMN "motivo_anulacion" text;--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ADD COLUMN "reversion_id" uuid;--> statement-breakpoint
ALTER TABLE "reversiones" ADD CONSTRAINT "reversiones_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reversiones" ADD CONSTRAINT "reversiones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reversiones_deal_idx" ON "reversiones" USING btree ("deal_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "reversiones_evento_idx" ON "reversiones" USING btree ("evento_tipo","evento_id") WHERE "reversiones"."evento_id" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_reversion_id_reversiones_id_fk" FOREIGN KEY ("reversion_id") REFERENCES "public"."reversiones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD CONSTRAINT "deal_actividades_anulado_por_users_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ADD CONSTRAINT "deal_etapa_historial_reversion_id_reversiones_id_fk" FOREIGN KEY ("reversion_id") REFERENCES "public"."reversiones"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "change_log_registro_idx" ON "change_log" USING btree ("registro_id");--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_anulacion_completa" CHECK (("abonos"."anulado_en" IS NULL AND "abonos"."anulado_por" IS NULL AND "abonos"."motivo_anulacion" IS NULL)
          OR ("abonos"."anulado_en" IS NOT NULL AND "abonos"."anulado_por" IS NOT NULL
              AND ("abonos"."motivo_anulacion" IS NULL OR length(trim("abonos"."motivo_anulacion")) > 0)));--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_anulacion_completa" CHECK (("calls"."anulado_en" IS NULL AND "calls"."anulado_por" IS NULL AND "calls"."motivo_anulacion" IS NULL)
          OR ("calls"."anulado_en" IS NOT NULL AND "calls"."anulado_por" IS NOT NULL
              AND ("calls"."motivo_anulacion" IS NULL OR length(trim("calls"."motivo_anulacion")) > 0)));--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD CONSTRAINT "deal_actividades_anulacion_completa" CHECK (("deal_actividades"."anulado_en" IS NULL AND "deal_actividades"."anulado_por" IS NULL AND "deal_actividades"."motivo_anulacion" IS NULL)
          OR ("deal_actividades"."anulado_en" IS NOT NULL AND "deal_actividades"."anulado_por" IS NOT NULL
              AND ("deal_actividades"."motivo_anulacion" IS NULL OR length(trim("deal_actividades"."motivo_anulacion")) > 0)));--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_anulacion_completa" CHECK (("deals"."anulado_en" IS NULL AND "deals"."anulado_por" IS NULL AND "deals"."motivo_anulacion" IS NULL)
          OR ("deals"."anulado_en" IS NOT NULL AND "deals"."anulado_por" IS NOT NULL
              AND ("deals"."motivo_anulacion" IS NULL OR length(trim("deals"."motivo_anulacion")) > 0)));