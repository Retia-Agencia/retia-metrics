CREATE TABLE "plataformas_programa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plataforma_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "plataformas_programa" ADD CONSTRAINT "plataformas_programa_plataforma_id_plataformas_pago_id_fk" FOREIGN KEY ("plataforma_id") REFERENCES "public"."plataformas_pago"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plataformas_programa" ADD CONSTRAINT "plataformas_programa_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "plataformas_programa_par_idx" ON "plataformas_programa" USING btree ("plataforma_id","program_id");--> statement-breakpoint
-- Backfill (ADR 0034 punto 4). Va en la MISMA migracion a proposito: una plataforma
-- sin vinculos es invisible, asi que entre crear la tabla y llenarla los selectores de
-- plataforma saldrian VACIOS en toda la app.
--
-- Asocia TODAS las plataformas a TODOS los programas, que es el comportamiento de hoy
-- (hoy no hay filtro: las siete se ven en los dos programas). NO se deriva de
-- `enlaces_pago`: medido en production el 20-sep, seis de las siete plataformas tienen
-- cero enlaces y cero abonos, y derivar el de la septima dejaria PayPal solo en
-- `comunicarte` — o sea Tactical Investor perderia PayPal de su selector sin que nadie
-- lo hubiera decidido. El equipo desasocia lo que no aplique desde la pantalla, con su
-- fila en `change_log`.
INSERT INTO "plataformas_programa" ("plataforma_id", "program_id")
SELECT p."id", pr."id" FROM "plataformas_pago" p CROSS JOIN "programs" pr
ON CONFLICT DO NOTHING;
