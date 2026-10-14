-- Ticket 119: la conexion con Meta (un solo token activo) y las cuentas publicitarias de cada programa.
-- Solo crea; la FK hacia programs pide un candado breve sobre esa tabla, por eso el lock_timeout.
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TABLE "cuentas_publicitarias" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"id_meta" text NOT NULL,
	"program_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"moneda" text NOT NULL,
	"zona_horaria" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meta_conexiones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"token_secreto" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuentas_publicitarias" ADD CONSTRAINT "cuentas_publicitarias_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cuentas_publicitarias_id_meta_idx" ON "cuentas_publicitarias" USING btree ("id_meta");--> statement-breakpoint
CREATE INDEX "cuentas_publicitarias_programa_idx" ON "cuentas_publicitarias" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "meta_conexiones_una_activa_idx" ON "meta_conexiones" USING btree ((true)) WHERE "meta_conexiones"."activo";--> statement-breakpoint
ALTER TABLE "meta_conexiones" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "cuentas_publicitarias" ENABLE ROW LEVEL SECURITY;
