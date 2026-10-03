-- Ticket 175 (ADR 0077 punto 3): se quitan Orígenes del lead y Categorías de recurso.
-- Medido en producción el 3-oct: 0 llamadas con origen_id y 0 recursos con categoría.
-- Orden: primero las columnas (sus FK y el índice viejo de recursos se van con ellas),
-- después el índice nuevo y al final las tablas, sin CASCADE: si algo más las referencia, falla.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "calls" DROP COLUMN "origen_id";--> statement-breakpoint
DROP INDEX IF EXISTS "recursos_vigente_idx";--> statement-breakpoint
ALTER TABLE "recursos" DROP COLUMN "categoria_id";--> statement-breakpoint
CREATE UNIQUE INDEX "recursos_vigente_idx" ON "recursos" USING btree (coalesce("program_id", '00000000-0000-0000-0000-000000000000'::uuid),lower("titulo")) WHERE "recursos"."vigente" = true and "recursos"."activo" = true;--> statement-breakpoint
DROP TABLE "categorias_recurso";--> statement-breakpoint
DROP TABLE "origenes";
