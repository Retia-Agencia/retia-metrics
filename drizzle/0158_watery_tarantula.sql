ALTER TABLE "skus" ADD COLUMN "predeterminado" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- ADR 0140: hoy un deal nuevo nace con la línea del ciclo que vende. Para que el despliegue no deje a
-- todos "Sin SKU", marca predeterminado cada SKU activo con cupo cuyo ciclo vende hoy (día de Bogotá,
-- ventana inclusiva, igual que estadoDeCohorte). Gerencia lo cambia después desde la tabla de SKUs.
UPDATE "skus" SET "predeterminado" = true
WHERE "activo" = true AND "cuenta_como_cupo" = true
  AND "cohort_id" IN (
    SELECT "id" FROM "cohorts"
    WHERE "fecha_inicio_ventas" IS NOT NULL AND "fecha_cierre_ventas" IS NOT NULL
      AND (now() AT TIME ZONE 'America/Bogota')::date BETWEEN "fecha_inicio_ventas" AND "fecha_cierre_ventas"
  );
