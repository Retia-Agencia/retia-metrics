-- Fuera `source_id` de `sync_runs` (F-07). Va en su propia migracion, despues del
-- backfill de la 0016, para que ningun dato dependa de una columna que ya no esta.
-- La atribucion que guardaba era arbitraria entre las fuentes del programa; lo que
-- SI se queria saber (que fuentes leyo y cuantas filas trajo cada una) vive ahora en
-- `fuentes_leidas`. La trazabilidad de la bitacora no se toca: `change_log.sync_run_id`
-- sigue apuntando a la corrida.
ALTER TABLE "sync_runs" DROP CONSTRAINT "sync_runs_source_id_sources_id_fk";
--> statement-breakpoint
DROP INDEX "sync_runs_fuente_idx";--> statement-breakpoint
ALTER TABLE "sync_runs" DROP COLUMN "source_id";