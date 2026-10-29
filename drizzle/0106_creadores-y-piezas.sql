CREATE TABLE "creadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"cuentas" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"program_id" uuid,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "piezas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid,
	"creador_id" uuid NOT NULL,
	"tipo_id" uuid NOT NULL,
	"red" text NOT NULL,
	"cta" text,
	"fecha_publicacion" date,
	"permanente" boolean DEFAULT false NOT NULL,
	"codigo" text NOT NULL,
	"publicada_en" timestamp with time zone,
	"creada_por" uuid,
	"anulado_en" timestamp with time zone,
	"anulado_por" uuid,
	"motivo_anulacion" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "piezas_fecha_o_permanente" CHECK (("piezas"."fecha_publicacion" IS NOT NULL) <> "piezas"."permanente")
);
--> statement-breakpoint
CREATE TABLE "tipos_pieza" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creadores" ADD CONSTRAINT "creadores_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piezas" ADD CONSTRAINT "piezas_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piezas" ADD CONSTRAINT "piezas_creador_id_creadores_id_fk" FOREIGN KEY ("creador_id") REFERENCES "public"."creadores"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piezas" ADD CONSTRAINT "piezas_tipo_id_tipos_pieza_id_fk" FOREIGN KEY ("tipo_id") REFERENCES "public"."tipos_pieza"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piezas" ADD CONSTRAINT "piezas_creada_por_users_id_fk" FOREIGN KEY ("creada_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "piezas" ADD CONSTRAINT "piezas_anulado_por_users_id_fk" FOREIGN KEY ("anulado_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "creadores_slug_idx" ON "creadores" USING btree (lower("slug"));--> statement-breakpoint
CREATE INDEX "creadores_programa_idx" ON "creadores" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "piezas_codigo_idx" ON "piezas" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "piezas_permanente_idx" ON "piezas" USING btree ("creador_id","red") WHERE "piezas"."permanente" AND "piezas"."anulado_en" IS NULL;--> statement-breakpoint
CREATE INDEX "piezas_programa_idx" ON "piezas" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "piezas_creador_idx" ON "piezas" USING btree ("creador_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tipos_pieza_nombre_idx" ON "tipos_pieza" USING btree (lower("nombre"));