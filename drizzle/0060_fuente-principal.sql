-- Ticket 092 (ADR 0068): la URL publica del formulario vive en la fuente, con a lo sumo una principal
-- por programa. Aditiva: toda fuente nace con principal = false, asi que el CHECK se cumple sin tocar
-- datos. Cual fuente es la principal de cada programa NO lo decide esta migracion: es una decision de
-- negocio (ok de Mani) y se hace despues desde /ajustes/fuentes. programs.form_url se queda hasta el
-- paso 2 del ADR 0068 punto 5.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "url_publica" text;--> statement-breakpoint
ALTER TABLE "sources" ADD COLUMN "principal" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "sources_una_principal_por_programa_idx" ON "sources" USING btree ("program_id") WHERE "sources"."principal";--> statement-breakpoint
ALTER TABLE "sources" ADD CONSTRAINT "sources_principal_repartible" CHECK (NOT "sources"."principal" OR ("sources"."activo" AND "sources"."url_publica" IS NOT NULL));
