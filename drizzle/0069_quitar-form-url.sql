-- Ticket 092, paso 2 del ADR 0068: el destino de un link sale de la fuente principal, asi que
-- programs.form_url se retira con su mitad del CHECK de la 0031. Que un programa activo tenga
-- principal es entre dos tablas y lo verifica reactivarPrograma. Se aplica con el codigo sin
-- form_url ya desplegado (drizzle pide las columnas por nombre) y con la principal de cada
-- programa activo ya marcada (los valores de hoy se copian a su fuente, ok de Mani).
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "programs" DROP CONSTRAINT "programs_activo_con_formulario_y_token";--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "form_url";--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_activo_con_token" CHECK (NOT "programs"."activo" OR "programs"."calendly_token" IS NOT NULL);
