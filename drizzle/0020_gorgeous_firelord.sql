-- ═══════════════════════════════════════════════════════════════════════════
-- 0020 · El corte de la etapa 1 del CRM v2 (tickets 036 a 042)
--
-- UNA migracion pensada para todo el corte, no seis parches. El ORDEN de los
-- cinco pasos NO es negociable y esta escrito en el ticket 042.
--
-- ⚠️ Este archivo se genero con `drizzle-kit generate` y despues se REESCRIBIO a
-- mano. Lo generado tenia cuatro defectos que lo habrian hecho destructivo o lo
-- habrian hecho fallar, y cada arreglo esta anotado donde va:
--   1. `DROP TABLE people CASCADE` + `CREATE TABLE leads` — habria borrado 2.059
--      leads en dev y 4.791 en production. Es un RENAME.
--   2. los `DROP CONSTRAINT` iban DESPUES del `DROP TABLE ... CASCADE` que ya se
--      los habia llevado: la migracion reventaba en la segunda sentencia.
--   3. el indice unico parcial de `sources` iba ANTES de desactivar `Forms
--      viejo`, y ComunicArte tiene hoy dos fuentes de leads activas.
--   4. las 271 filas de `change_log` que dicen `tabla = 'people'` se quedaban
--      hablando de una tabla inexistente.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Renombres y cambios de tipo (ticket 036) ────────────────────────────
-- `people` se RENOMBRA. No se borra y se vuelve a crear: la tabla tiene 2.059
-- filas en dev y 4.791 en production, y son el unico dato real del sistema.
ALTER TABLE "people" RENAME TO "leads";--> statement-breakpoint
ALTER TABLE "leads" RENAME CONSTRAINT "people_pkey" TO "leads_pkey";--> statement-breakpoint
ALTER TABLE "leads" RENAME CONSTRAINT "people_program_id_programs_id_fk" TO "leads_program_id_programs_id_fk";--> statement-breakpoint
ALTER TABLE "leads" RENAME CONSTRAINT "people_cohort_id_cohorts_id_fk" TO "leads_cohort_id_cohorts_id_fk";--> statement-breakpoint
ALTER INDEX "people_programa_email_idx" RENAME TO "leads_programa_email_idx";--> statement-breakpoint
ALTER INDEX "people_programa_estado_idx" RENAME TO "leads_programa_estado_idx";--> statement-breakpoint
ALTER INDEX "people_cohorte_idx" RENAME TO "leads_cohorte_idx";--> statement-breakpoint

-- `responsable_closer_id` nunca guardo un dato: 0 filas lo tenian puesto
-- (medido el 21-sep). Su reemplazo es `deals.owner_user_id` (ADR 0037).
ALTER TABLE "leads" DROP COLUMN "responsable_closer_id";--> statement-breakpoint

-- `estado` de enum a texto (ADR 0032). El default hay que soltarlo antes del
-- cambio de tipo y volver a ponerlo despues: Postgres no puede castear un
-- default de un tipo que esta dejando de existir.
ALTER TABLE "leads" ALTER COLUMN "estado" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "estado" SET DATA TYPE text USING "estado"::text;--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "estado" SET DEFAULT 'cola_setteo';--> statement-breakpoint

-- La bitacora habla de la MISMA entidad: solo cambio su nombre. Dejarla diciendo
-- 'people' partiria el historial del lead en dos nombres para siempre, y la
-- pantalla del ticket 076 tendria que conocer los dos. No es fabricar historia
-- —no se inventa ni se borra una sola fila—: es renombrar la etiqueta de una
-- tabla que se renombro.
UPDATE "change_log" SET "tabla" = 'leads' WHERE "tabla" = 'people';--> statement-breakpoint

-- ── 2. Las seis tablas del modelo nuevo (ticket 037) ───────────────────────
CREATE TYPE "public"."estado_fuente" AS ENUM('activa', 'rota');--> statement-breakpoint
CREATE TYPE "public"."etapa_deal" AS ENUM('pendiente_setteo', 'en_contacto', 'pendiente_reagenda', 'agendado', 'atendido', 'compromiso_verbal', 'abonado', 'completo', 'proxima_cohorte', 'cierre_perdido');--> statement-breakpoint
CREATE TYPE "public"."tipo_actividad" AS ENUM('contacto', 'nota');--> statement-breakpoint
CREATE TYPE "public"."tipo_contacto" AS ENUM('correo', 'telefono');--> statement-breakpoint
CREATE TABLE "cuotas_pactadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"monto" numeric(12, 2) NOT NULL,
	"moneda" text DEFAULT 'USD' NOT NULL,
	"fecha_pactada" date NOT NULL,
	"abono_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deal_actividades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"tipo" "tipo_actividad" NOT NULL,
	"canal" text,
	"user_id" uuid NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	"nota" text
);
--> statement-breakpoint
CREATE TABLE "deal_etapa_historial" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"de" "etapa_deal",
	"a" "etapa_deal" NOT NULL,
	"user_id" uuid,
	"motivo_id" uuid,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"cohort_id" uuid,
	"owner_user_id" uuid,
	"etapa" "etapa_deal" DEFAULT 'pendiente_setteo' NOT NULL,
	"producto_id" uuid,
	"motivo_id" uuid,
	"submission_origen_id" uuid,
	"onboarded_at" timestamp with time zone,
	"creado_por" uuid,
	"anulado_en" timestamp with time zone,
	"anulado_por" uuid,
	"motivo_anulacion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deals_anulacion_completa" CHECK (("deals"."anulado_en" IS NULL AND "deals"."anulado_por" IS NULL AND "deals"."motivo_anulacion" IS NULL)
          OR ("deals"."anulado_en" IS NOT NULL AND "deals"."anulado_por" IS NOT NULL
              AND length(trim("deals"."motivo_anulacion")) > 0))
);
--> statement-breakpoint
CREATE TABLE "lead_contactos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"tipo" "tipo_contacto" NOT NULL,
	"valor" text NOT NULL,
	"submission_id" uuid,
	"es_principal" boolean DEFAULT false NOT NULL,
	"confirmado" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lead_id" uuid,
	"source_id" uuid NOT NULL,
	"token" text NOT NULL,
	"es_parcial" boolean DEFAULT false NOT NULL,
	"fecha_envio" timestamp with time zone,
	"estado_hoja" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"utm_term" text,
	"utm_content" text,
	"posicion_en_hoja" integer,
	"respuestas" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuotas_pactadas" ADD CONSTRAINT "cuotas_pactadas_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cuotas_pactadas" ADD CONSTRAINT "cuotas_pactadas_abono_id_abonos_id_fk" FOREIGN KEY ("abono_id") REFERENCES "public"."abonos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD CONSTRAINT "deal_actividades_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_actividades" ADD CONSTRAINT "deal_actividades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ADD CONSTRAINT "deal_etapa_historial_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ADD CONSTRAINT "deal_etapa_historial_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ADD CONSTRAINT "deal_etapa_historial_motivo_id_motivos_id_fk" FOREIGN KEY ("motivo_id") REFERENCES "public"."motivos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_producto_id_productos_id_fk" FOREIGN KEY ("producto_id") REFERENCES "public"."productos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_motivo_id_motivos_id_fk" FOREIGN KEY ("motivo_id") REFERENCES "public"."motivos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_submission_origen_id_submissions_id_fk" FOREIGN KEY ("submission_origen_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_creado_por_users_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_anulado_por_users_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_contactos" ADD CONSTRAINT "lead_contactos_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_contactos" ADD CONSTRAINT "lead_contactos_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lead_contactos" ADD CONSTRAINT "lead_contactos_submission_id_submissions_id_fk" FOREIGN KEY ("submission_id") REFERENCES "public"."submissions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_lead_id_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cuotas_pactadas_numero_idx" ON "cuotas_pactadas" USING btree ("deal_id","numero");--> statement-breakpoint
CREATE INDEX "cuotas_pactadas_vencimiento_idx" ON "cuotas_pactadas" USING btree ("fecha_pactada");--> statement-breakpoint
CREATE INDEX "deal_actividades_deal_idx" ON "deal_actividades" USING btree ("deal_id","fecha");--> statement-breakpoint
CREATE INDEX "deal_etapa_historial_deal_idx" ON "deal_etapa_historial" USING btree ("deal_id","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "deals_uno_abierto_por_lead_y_programa_idx" ON "deals" USING btree ("lead_id","program_id") WHERE "deals"."etapa" not in ('completo', 'cierre_perdido') and "deals"."anulado_en" is null;--> statement-breakpoint
CREATE INDEX "deals_programa_etapa_idx" ON "deals" USING btree ("program_id","etapa");--> statement-breakpoint
CREATE INDEX "deals_owner_idx" ON "deals" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "deals_cohorte_idx" ON "deals" USING btree ("cohort_id");--> statement-breakpoint
CREATE UNIQUE INDEX "lead_contactos_valor_idx" ON "lead_contactos" USING btree ("program_id","tipo","valor");--> statement-breakpoint
CREATE INDEX "lead_contactos_lead_idx" ON "lead_contactos" USING btree ("lead_id");--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_fuente_token_idx" ON "submissions" USING btree ("source_id","token");--> statement-breakpoint
CREATE INDEX "submissions_lead_idx" ON "submissions" USING btree ("lead_id");--> statement-breakpoint

-- ── 3. `calls` y `abonos` cuelgan del deal; `sales` se elimina (ticket 038) ─
-- Los DROP CONSTRAINT van ANTES del DROP TABLE. Al reves, el CASCADE ya se los
-- llevo y la sentencia falla por un constraint que ya no existe.
ALTER TABLE "abonos" DROP CONSTRAINT "abonos_sale_id_sales_id_fk";--> statement-breakpoint
ALTER TABLE "calls" DROP CONSTRAINT "calls_person_id_people_id_fk";--> statement-breakpoint
DROP INDEX "abonos_venta_idx";--> statement-breakpoint
DROP INDEX "calls_persona_idx";--> statement-breakpoint
ALTER TABLE "abonos" DROP COLUMN "sale_id";--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN "person_id";--> statement-breakpoint

-- Sin CASCADE a proposito: si algo mas referenciara `sales`, esto tiene que
-- fallar RUIDOSAMENTE en vez de llevarselo por delante en silencio.
DROP TABLE "sales";--> statement-breakpoint

-- `abonos.deal_id` es NOT NULL sin default: un abono siempre cuelga de un deal.
-- Solo aplica sobre una tabla vacia, y lo es (0 filas en production, medido el
-- 21-sep).
ALTER TABLE "abonos" ADD COLUMN "deal_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "calls" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "abonos_deal_idx" ON "abonos" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "calls_deal_idx" ON "calls" USING btree ("deal_id");--> statement-breakpoint

-- ── 4. `sources`: los DATOS primero, el indice al final (ticket 039) ───────
-- ⚠️ EL ORDEN DE ESTE PASO ES EL QUE MAS IMPORTA DE TODA LA MIGRACION.
--
-- Las 7 filas con `destino != 'people'` se borran ANTES de que la columna
-- desaparezca (despues no habria con que seleccionarlas). Sus coordenadas
-- —archivo y pestana— estan copiadas en el ticket 077, que es donde la
-- migracion one-time de la etapa 7 las necesita, y su `mapeo_columnas` estaba
-- VACIO en las 7 (medido contra dev el 21-sep): no se pierde ningun trabajo.
DELETE FROM "sources" WHERE "destino" <> 'people';--> statement-breakpoint

-- `Forms viejo` se DESACTIVA, no se borra: la etapa 7 recupera sus 55 personas
-- con sus envios, y esos `submissions.source_id` necesitan apuntar a algo que
-- diga la verdad sobre de donde salieron.
UPDATE "sources" SET "activo" = false WHERE "nombre" = 'Formulario anterior' AND "tab" = 'Forms viejo';--> statement-breakpoint

ALTER TABLE "sources" ADD COLUMN "tz_fechas" text DEFAULT 'America/Bogota' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "estado" "estado_fuente" DEFAULT 'activa' NOT NULL;--> statement-breakpoint
ALTER TABLE "sources" DROP COLUMN "destino";--> statement-breakpoint

-- Y SOLO AHORA el indice. Si fuera antes del UPDATE de arriba, falla:
-- ComunicArte tiene DOS fuentes de leads activas. Misma leccion que el CHECK de
-- la migracion 0009.
CREATE UNIQUE INDEX "sources_una_activa_por_programa_idx" ON "sources" USING btree ("program_id") WHERE "sources"."activo" = true;--> statement-breakpoint

-- ── 5. Cierre ──────────────────────────────────────────────────────────────
-- El enum de `estado` se va al final, cuando ya nadie lo usa.
DROP TYPE "public"."estado_persona";
