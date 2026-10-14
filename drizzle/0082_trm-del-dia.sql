-- 244: la TRM del día (ADR 0088). Solo crea una tabla nueva, sin FK: no pide candado sobre ninguna tabla viva.
CREATE TABLE "tasas_cambio" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vigente_desde" date NOT NULL,
	"vigente_hasta" date NOT NULL,
	"pesos_por_dolar" numeric(12, 2) NOT NULL,
	"fuente" text NOT NULL,
	"leida_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasas_cambio_vigente_desde_unique" UNIQUE("vigente_desde"),
	CONSTRAINT "tasas_cambio_rango_chk" CHECK ("tasas_cambio"."vigente_hasta" >= "tasas_cambio"."vigente_desde"),
	CONSTRAINT "tasas_cambio_positiva_chk" CHECK ("tasas_cambio"."pesos_por_dolar" > 0)
);--> statement-breakpoint
ALTER TABLE "tasas_cambio" ENABLE ROW LEVEL SECURITY;
