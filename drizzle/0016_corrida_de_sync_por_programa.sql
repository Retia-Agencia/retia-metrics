-- Una corrida de sync es de un PROGRAMA, no de una fuente (F-03 + F-07).
--
-- El orden importa y por eso esta migracion esta escrita a mano: drizzle-kit
-- genero `ADD COLUMN "program_id" uuid NOT NULL`, que en `dev` habria pasado
-- (0 corridas) y en `production` habria reventado (6 corridas ya guardadas).
-- Es la regla de la casa: un NOT NULL o un CHECK nuevo se crea DESPUES de
-- arreglar los datos, en la misma migracion.
ALTER TABLE "sync_runs" ADD COLUMN "program_id" uuid;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD COLUMN "fuentes_leidas" jsonb;--> statement-breakpoint

-- Backfill: el programa de la corrida es el de la fuente a la que estaba
-- atribuida. Esa atribucion era arbitraria ENTRE las fuentes de un programa
-- (`fuentes[0]`), pero nunca cruzo de programa, asi que el programa que se
-- deduce si es el correcto. Una corrida sin fuente no se puede deducir: en vez
-- de inventarle un programa, el SET NOT NULL de abajo falla ruidosamente.
UPDATE "sync_runs" r
   SET "program_id" = s."program_id"
  FROM "sources" s
 WHERE s."id" = r."source_id";--> statement-breakpoint

ALTER TABLE "sync_runs" ALTER COLUMN "program_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sync_runs_programa_idx" ON "sync_runs" USING btree ("program_id","iniciado");--> statement-breakpoint

-- El candado de F-03. Antes de crearlo hay que dejar los datos en un estado que
-- lo admita: una corrida 'corriendo' de hace horas es una funcion que se cayo,
-- no un sync vivo, y dos de esas en el mismo programa impedirian crear el
-- indice. Se cierran como 'error' con el porque escrito, que es exactamente lo
-- que hara el reaper de `lib/sheets/sync.ts` de aqui en adelante.
UPDATE "sync_runs"
   SET "estado" = 'error',
       "terminado" = now(),
       "errores" = '["Corrida abandonada: quedo en corriendo antes del candado por programa (F-03)."]'::jsonb
 WHERE "estado" = 'corriendo';--> statement-breakpoint

CREATE UNIQUE INDEX "sync_runs_una_corriendo_por_programa_idx" ON "sync_runs" USING btree ("program_id") WHERE "sync_runs"."estado" = 'corriendo';
