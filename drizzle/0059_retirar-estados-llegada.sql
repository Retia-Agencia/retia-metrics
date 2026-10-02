-- Ticket 117, fase 2 (ADR 0069 punto 5; ok de Mani el 2-oct): se retira la tabla de Estados de llegada.
-- Desde el 0069 la etapa de entrada la decide el CRM con la agenda y la calidad; el codigo
-- desplegado ya no lee esta tabla (3f8509a) y un guardian lo vigila (tests/ingesta-estado.test.ts).
-- Reescrita sobre el borrador de drizzle-kit: SIN CASCADE (nada depende de la tabla; si algo
-- dependiera, que falle en vez de llevarselo en silencio) y con lock_timeout (AGENTS.md).
-- Las filas de change_log que hablan de estados_llegada se quedan: son historia.
SET lock_timeout = '5s';--> statement-breakpoint
DROP TABLE "estados_llegada";--> statement-breakpoint
DROP TYPE "public"."prioridad_llegada";
