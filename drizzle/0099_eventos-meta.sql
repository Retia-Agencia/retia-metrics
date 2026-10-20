-- 281 (ADR 0097): la bandeja de salida hacia la API de Conversiones de Meta y el tipo de
-- integracion `meta_capi`. Tabla nueva, sin datos que arreglar; el ALTER TYPE es barato.
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."estado_evento_meta" AS ENUM('pendiente', 'enviado', 'fallido', 'vencido', 'omitido');--> statement-breakpoint
CREATE TYPE "public"."evento_meta" AS ENUM('purchase');--> statement-breakpoint
ALTER TYPE "public"."tipo_integracion" ADD VALUE IF NOT EXISTS 'meta_capi';--> statement-breakpoint
CREATE TABLE "eventos_meta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"evento" "evento_meta" NOT NULL,
	"estado" "estado_evento_meta" DEFAULT 'pendiente' NOT NULL,
	"razon" text,
	"event_id" text NOT NULL,
	"event_time" timestamp with time zone NOT NULL,
	"valor" numeric(10, 2),
	"moneda" text DEFAULT 'USD' NOT NULL,
	"intentos" integer DEFAULT 0 NOT NULL,
	"proximo_intento_en" timestamp with time zone,
	"ultimo_error" text,
	"enviado_en" timestamp with time zone,
	"llevo_fbc" boolean,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "eventos_meta" ADD CONSTRAINT "eventos_meta_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eventos_meta" ADD CONSTRAINT "eventos_meta_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "eventos_meta_deal_evento_idx" ON "eventos_meta" USING btree ("deal_id","evento");--> statement-breakpoint
CREATE INDEX "eventos_meta_programa_estado_idx" ON "eventos_meta" USING btree ("program_id","estado");--> statement-breakpoint
ALTER TABLE "eventos_meta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
-- El envio: pg_cron llama POST /api/cron/meta-capi cada 5 minutos, corrido 2 minutos de :00 (molde de
-- la 0092: URL y CRON_SECRET desde Supabase Vault; sin pg_cron ni pg_net el bloque no hace nada).
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_available_extensions WHERE name IN ('pg_cron', 'pg_net')) = 2 THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog';
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions';
    EXECUTE $job$
      SELECT cron.schedule(
        'enviar-meta-capi',
        '2-59/5 * * * *',
        $cmd$
          SELECT net.http_post(
            url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'crm_url')
                   || '/api/cron/meta-capi',
            headers := jsonb_build_object(
              'Authorization',
              'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
            ),
            timeout_milliseconds := 60000
          )
        $cmd$
      )
    $job$;
  END IF;
END
$$;
