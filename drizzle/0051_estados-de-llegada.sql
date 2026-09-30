-- Ticket 117, ADR 0061: los Estados de llegada por tabla.
-- 1. La tabla `estados_llegada` (catalogo por programa, ADR 0012).
-- 2. `leads.calificacion` y `submissions.calificacion` pasan del enum `calificacion_envio`
--    a texto, conservando los valores de hoy (el cast enum -> text es exacto).
-- El enum NO se borra aqui: el codigo desplegado antes del 117 todavia escribe
-- `::calificacion_envio` en SQL crudo (el resumen de `ingerir.ts`), y enum -> text es un
-- cast de asignacion, asi que sigue funcionando contra la columna de texto. Lo borra la 0051,
-- DESPUES del deploy.
-- `leads` y `submissions` son tablas calientes (el webhook escribe): el ALTER pide candado
-- exclusivo y, si espera, deja en fila toda lectura. Falla en 5 s y se reintenta (0043).
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."prioridad_llegada" AS ENUM('normal', 'alta');--> statement-breakpoint
CREATE TABLE "estados_llegada" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"valor" text NOT NULL,
	"etapa_entrada" "etapa_deal",
	"prioridad" "prioridad_llegada" DEFAULT 'normal' NOT NULL,
	"alerta_minutos" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "estados_llegada_etapa_de_entrada" CHECK ("estados_llegada"."etapa_entrada" IS NULL OR "estados_llegada"."etapa_entrada"::text IN ('pendiente_setteo', 'agendado')),
	CONSTRAINT "estados_llegada_alerta_positiva" CHECK ("estados_llegada"."alerta_minutos" IS NULL OR "estados_llegada"."alerta_minutos" > 0),
	CONSTRAINT "estados_llegada_valor_no_vacio" CHECK (length(trim("estados_llegada"."valor")) > 0)
);
--> statement-breakpoint
ALTER TABLE "estados_llegada" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "estados_llegada" ADD CONSTRAINT "estados_llegada_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "estados_llegada_programa_valor_idx" ON "estados_llegada" USING btree ("program_id",lower(trim("valor")));--> statement-breakpoint
ALTER TABLE "leads" ALTER COLUMN "calificacion" SET DATA TYPE text USING "calificacion"::text;--> statement-breakpoint
ALTER TABLE "submissions" ALTER COLUMN "calificacion" SET DATA TYPE text USING "calificacion"::text;
