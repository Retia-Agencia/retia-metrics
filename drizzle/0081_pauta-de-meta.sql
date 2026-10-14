-- Ticket 120. Crea el arbol y el gasto de Meta y retira ad_spend (vacia, 0 filas el 14-oct; sin CASCADE para
-- que falle si algo dependiera de ella). Las FK hacia programs piden un candado breve, por eso el lock_timeout.
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."estado_sincronizacion_pauta" AS ENUM('corriendo', 'ok', 'error');--> statement-breakpoint
CREATE TYPE "public"."nivel_pauta" AS ENUM('campana', 'conjunto', 'anuncio');--> statement-breakpoint
CREATE TYPE "public"."origen_gasto" AS ENUM('meta_api', 'manual');--> statement-breakpoint
CREATE TABLE "gasto_pauta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"fecha" date NOT NULL,
	"monto" numeric(14, 2) NOT NULL,
	"moneda" text NOT NULL,
	"agendas_meta" integer,
	"origen" "origen_gasto" NOT NULL,
	"pauta_objeto_id" uuid,
	"area" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "gasto_pauta_un_destino_chk" CHECK (("gasto_pauta"."pauta_objeto_id" is not null) <> ("gasto_pauta"."area" is not null)),
	CONSTRAINT "gasto_pauta_area_chk" CHECK ("gasto_pauta"."area" is null or "gasto_pauta"."area" in ('paid', 'organico', 'referidos')),
	CONSTRAINT "gasto_pauta_meta_con_objeto_chk" CHECK ("gasto_pauta"."origen" = 'manual' or "gasto_pauta"."pauta_objeto_id" is not null)
);
--> statement-breakpoint
CREATE TABLE "pauta_objetos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cuenta_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"id_meta" text NOT NULL,
	"nivel" "nivel_pauta" NOT NULL,
	"padre_id_meta" text,
	"nombre" text NOT NULL,
	"estado" text NOT NULL,
	"objetivo" text,
	"formato" text,
	"url_tags" text,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pauta_objetos_id_meta_unique" UNIQUE("id_meta"),
	CONSTRAINT "pauta_objetos_padre_por_nivel_chk" CHECK (("pauta_objetos"."nivel" = 'campana' and "pauta_objetos"."padre_id_meta" is null) or ("pauta_objetos"."nivel" <> 'campana' and "pauta_objetos"."padre_id_meta" is not null)),
	CONSTRAINT "pauta_objetos_objetivo_campana_chk" CHECK ("pauta_objetos"."objetivo" is null or "pauta_objetos"."nivel" = 'campana'),
	CONSTRAINT "pauta_objetos_formato_anuncio_chk" CHECK ("pauta_objetos"."formato" is null or ("pauta_objetos"."nivel" = 'anuncio' and "pauta_objetos"."formato" in ('video', 'imagen', 'carrusel'))),
	CONSTRAINT "pauta_objetos_url_tags_anuncio_chk" CHECK ("pauta_objetos"."url_tags" is null or "pauta_objetos"."nivel" = 'anuncio')
);
--> statement-breakpoint
CREATE TABLE "pauta_sincronizaciones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inicio" timestamp with time zone DEFAULT now() NOT NULL,
	"fin" timestamp with time zone,
	"estado" "estado_sincronizacion_pauta" DEFAULT 'corriendo' NOT NULL,
	"disparada_por" text NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"filas" integer,
	"error" text,
	CONSTRAINT "pauta_sincronizaciones_disparada_por_chk" CHECK ("pauta_sincronizaciones"."disparada_por" in ('cron', 'manual'))
);
--> statement-breakpoint
DROP TABLE "ad_spend";--> statement-breakpoint
ALTER TABLE "gasto_pauta" ADD CONSTRAINT "gasto_pauta_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gasto_pauta" ADD CONSTRAINT "gasto_pauta_pauta_objeto_id_pauta_objetos_id_fk" FOREIGN KEY ("pauta_objeto_id") REFERENCES "public"."pauta_objetos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pauta_objetos" ADD CONSTRAINT "pauta_objetos_cuenta_id_cuentas_publicitarias_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuentas_publicitarias"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pauta_objetos" ADD CONSTRAINT "pauta_objetos_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "gasto_pauta_objeto_fecha_meta_idx" ON "gasto_pauta" USING btree ("pauta_objeto_id","fecha") WHERE "gasto_pauta"."origen" = 'meta_api';--> statement-breakpoint
CREATE INDEX "gasto_pauta_programa_fecha_idx" ON "gasto_pauta" USING btree ("program_id","fecha");--> statement-breakpoint
CREATE INDEX "pauta_objetos_programa_nivel_idx" ON "pauta_objetos" USING btree ("program_id","nivel");--> statement-breakpoint
CREATE UNIQUE INDEX "pauta_sincronizaciones_una_corriendo_idx" ON "pauta_sincronizaciones" USING btree ((true)) WHERE "pauta_sincronizaciones"."estado" = 'corriendo';--> statement-breakpoint
ALTER TABLE "pauta_objetos" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "gasto_pauta" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "pauta_sincronizaciones" ENABLE ROW LEVEL SECURITY;
