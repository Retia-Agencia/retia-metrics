CREATE TYPE "public"."estado_corte" AS ENUM('cerrado', 'activo', 'futuro');--> statement-breakpoint
CREATE TYPE "public"."estado_persona" AS ENUM('descartado', 'cola_setteo', 'invitado', 'show', 'cierre', 'perdido');--> statement-breakpoint
CREATE TYPE "public"."estado_sync" AS ENUM('corriendo', 'ok', 'error');--> statement-breakpoint
CREATE TYPE "public"."origen_cambio" AS ENUM('sync', 'app', 'upload');--> statement-breakpoint
CREATE TYPE "public"."resultado_llamada" AS ENUM('agendada', 'show', 'no_show', 'reagendada', 'cerrada', 'perdida');--> statement-breakpoint
CREATE TYPE "public"."tipo_fuente" AS ENUM('google_sheet', 'upload');--> statement-breakpoint
CREATE TABLE "ad_spend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"cohort_id" uuid,
	"campana" text,
	"creativo" text,
	"fecha" date,
	"inversion_cop" numeric(14, 2),
	"impresiones" integer,
	"clics" integer,
	"registros" integer,
	"huella_fila" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"cohort_id" uuid,
	"program_id" uuid NOT NULL,
	"closer_id" text,
	"email_lead" text,
	"fecha_agenda" timestamp with time zone,
	"fecha_llamada" timestamp with time zone,
	"resultado" "resultado_llamada" DEFAULT 'agendada' NOT NULL,
	"motivo_perdida" text,
	"notas" text,
	"origen" text DEFAULT 'sheets' NOT NULL,
	"huella_fila" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "change_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tabla" text NOT NULL,
	"registro_id" uuid,
	"etiqueta" text,
	"campo" text NOT NULL,
	"valor_anterior" text,
	"valor_nuevo" text,
	"detectado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"origen" "origen_cambio" DEFAULT 'sync' NOT NULL,
	"sync_run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "cohorts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"meta_cupos" integer NOT NULL,
	"precio_usd" numeric(10, 2) NOT NULL,
	"fecha_inicio_clases" date NOT NULL,
	"fecha_cierre_ventas" date NOT NULL,
	"trm_corte" numeric(10, 2) DEFAULT '4000' NOT NULL,
	"estado" "estado_corte" DEFAULT 'futuro' NOT NULL,
	"notas" text
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"email_normalizado" text NOT NULL,
	"nombre" text,
	"telefono" text,
	"cargo" text,
	"empresa" text,
	"ciudad" text,
	"pais" text,
	"ingreso_declarado" text,
	"urgencia" text,
	"por_que_aplico" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"fecha_primera_aplicacion" timestamp with time zone,
	"fecha_ultima_aplicacion" timestamp with time zone,
	"num_aplicaciones" integer DEFAULT 1 NOT NULL,
	"estado" "estado_persona" DEFAULT 'cola_setteo' NOT NULL,
	"motivo_descarte" text,
	"cohort_id" uuid,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"nombre" text NOT NULL,
	"ticket_usd" numeric(10, 2) NOT NULL,
	"record_personas_por_dia_habil" integer,
	"activo" boolean DEFAULT true NOT NULL,
	CONSTRAINT "programs_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid,
	"cohort_id" uuid,
	"program_id" uuid NOT NULL,
	"closer_id" text,
	"email_comprador" text,
	"fecha" date,
	"precio_lista_usd" numeric(10, 2),
	"precio_aplicado_usd" numeric(10, 2),
	"beca_aplicada" boolean DEFAULT false NOT NULL,
	"monto_abonado" numeric(12, 2),
	"moneda" text DEFAULT 'USD' NOT NULL,
	"es_pago_completo" boolean DEFAULT false NOT NULL,
	"huella_fila" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_fuente" DEFAULT 'google_sheet' NOT NULL,
	"sheet_id" text,
	"tab" text,
	"rango" text DEFAULT 'A1:BZ' NOT NULL,
	"mapeo_columnas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"destino" text DEFAULT 'people' NOT NULL,
	"ultima_sync" timestamp with time zone,
	"activo" boolean DEFAULT true NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid,
	"iniciado" timestamp with time zone DEFAULT now() NOT NULL,
	"terminado" timestamp with time zone,
	"estado" "estado_sync" DEFAULT 'corriendo' NOT NULL,
	"filas_leidas" integer DEFAULT 0 NOT NULL,
	"personas_nuevas" integer DEFAULT 0 NOT NULL,
	"personas_actualizadas" integer DEFAULT 0 NOT NULL,
	"registros_nuevos" integer DEFAULT 0 NOT NULL,
	"errores" jsonb
);
--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ad_spend" ADD CONSTRAINT "ad_spend_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "calls" ADD CONSTRAINT "calls_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "change_log" ADD CONSTRAINT "change_log_sync_run_id_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."sync_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_cohort_id_cohorts_id_fk" FOREIGN KEY ("cohort_id") REFERENCES "public"."cohorts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_source_id_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ad_spend_huella_idx" ON "ad_spend" USING btree ("program_id","huella_fila");--> statement-breakpoint
CREATE INDEX "calls_cohorte_closer_idx" ON "calls" USING btree ("cohort_id","closer_id");--> statement-breakpoint
CREATE INDEX "calls_persona_idx" ON "calls" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "calls_huella_idx" ON "calls" USING btree ("program_id","huella_fila");--> statement-breakpoint
CREATE INDEX "change_log_detectado_idx" ON "change_log" USING btree ("detectado_en");--> statement-breakpoint
CREATE UNIQUE INDEX "cohorts_programa_codigo_idx" ON "cohorts" USING btree ("program_id","codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "people_programa_email_idx" ON "people" USING btree ("program_id","email_normalizado");--> statement-breakpoint
CREATE INDEX "people_programa_estado_idx" ON "people" USING btree ("program_id","estado");--> statement-breakpoint
CREATE INDEX "people_cohorte_idx" ON "people" USING btree ("cohort_id");--> statement-breakpoint
CREATE INDEX "sales_cohorte_idx" ON "sales" USING btree ("cohort_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_huella_idx" ON "sales" USING btree ("program_id","huella_fila");--> statement-breakpoint
CREATE INDEX "sync_runs_fuente_idx" ON "sync_runs" USING btree ("source_id","iniciado");