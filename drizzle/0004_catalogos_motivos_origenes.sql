CREATE TABLE "motivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "origenes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "motivos_nombre_idx" ON "motivos" USING btree (lower("nombre"));--> statement-breakpoint
CREATE UNIQUE INDEX "origenes_nombre_idx" ON "origenes" USING btree (lower("nombre"));--> statement-breakpoint
INSERT INTO "motivos" ("nombre") VALUES ('Dinero'),('Horario'),('Sin fit'),('Viaje'),('Otro programa'),('Decisión de un tercero'),('Sin respuesta'),('Sin motivo');--> statement-breakpoint
INSERT INTO "origenes" ("nombre") VALUES ('Agenda del día'),('Follow-up'),('Cola de descartados'),('Cola de setteo'),('Masivos'),('Lanzamiento'),('Referido');