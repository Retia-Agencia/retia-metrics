-- 0122 (ticket 396, M7, ADR 0125): las ventanas de venta de dos cohortes del mismo programa no se solapan.
-- Decision de Mani (8-nov): no hay solape. Las dos parejas que existian (Tactical C2/C3 y Confianza C1/C2) se
-- corrigieron antes con editarCohorte (C2 de Tactical cierra el 27-sep, C1 de Confianza el 15-nov).
-- Un EXCLUDE con rango cerrado [] cuenta el dia de cierre como vendible. Solo compite quien tiene las dos fechas.
-- btree_gist da el operador "=" sobre uuid dentro del indice GiST.
SET lock_timeout = '5s';
--> statement-breakpoint
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_sin_solape_de_ventas" EXCLUDE USING gist (
  "program_id" WITH =,
  daterange("fecha_inicio_ventas", "fecha_cierre_ventas", '[]') WITH &&
) WHERE ("fecha_inicio_ventas" IS NOT NULL AND "fecha_cierre_ventas" IS NOT NULL);
