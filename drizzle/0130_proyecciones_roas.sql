-- Ticket 375: proyecciones del ROAS guardadas con su fecha. Tabla nueva y vacia; solo agrega.
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "proyecciones_roas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"dia" date NOT NULL,
	"desde" date NOT NULL,
	"hasta" date NOT NULL,
	"gasto_usd" numeric(14, 2),
	"vendido_usd" numeric(14, 2),
	"roas_a_hoy" numeric(10, 4),
	"roas_proyectado" numeric(10, 4),
	"motivo" text,
	"citas_pendientes" integer DEFAULT 0 NOT NULL,
	"ultima_cita_en" timestamp with time zone,
	"supuestos" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"confirmada_en" timestamp with time zone,
	"roas_real" numeric(10, 4),
	"creada_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proyecciones_roas_rango_chk" CHECK ("proyecciones_roas"."desde" <= "proyecciones_roas"."hasta"),
	CONSTRAINT "proyecciones_roas_citas_chk" CHECK ("proyecciones_roas"."citas_pendientes" >= 0)
);
--> statement-breakpoint
ALTER TABLE "proyecciones_roas" ADD CONSTRAINT "proyecciones_roas_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "proyecciones_roas_programa_dia_idx" ON "proyecciones_roas" USING btree ("program_id","dia");