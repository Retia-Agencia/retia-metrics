-- Tickets 145 y 210 (reunión del 8-oct). El rol Customer Success solo marca onboarded en Students;
-- el setter por defecto vive en la membresía, a lo sumo uno activo por programa (índice).
-- Aditiva: el código viejo no lee ninguna de las dos cosas, así que se puede aplicar antes del deploy.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TYPE "public"."rol" ADD VALUE 'customer_success';--> statement-breakpoint
ALTER TABLE "miembros_programa" ADD COLUMN "setter_por_defecto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "miembros_programa_setter_idx" ON "miembros_programa" USING btree ("program_id") WHERE "miembros_programa"."setter_por_defecto" AND "miembros_programa"."activo";