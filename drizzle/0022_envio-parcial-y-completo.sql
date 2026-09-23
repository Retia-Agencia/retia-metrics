-- ADR 0036 punto 4: la parcial y la completa de un mismo token de Typeform se guardan las
-- dos. El unico viejo `(source_id, token)` lo impedia. Afloja la llave: no puede fallar
-- sobre datos existentes (lo que era unico sin `es_parcial` lo sigue siendo con el).
DROP INDEX "submissions_fuente_token_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "submissions_fuente_token_idx" ON "submissions" USING btree ("source_id","token","es_parcial");
