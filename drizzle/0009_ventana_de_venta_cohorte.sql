ALTER TABLE "cohorts" ADD COLUMN "fecha_inicio_ventas" date;--> statement-breakpoint
-- ADR 0022: la ventana de venta es dato de cada cohorte. Los valores son los del reporte diario
-- de Retia (Comunicarte C2: 14-ago a 21-sep = 27 habiles; Tactical C2: 19-ago a 29-sep = 30).
-- El cierre sembrado de Comunicarte C2 (22-sep, el dia de clases) se corrige a la vispera.
UPDATE "cohorts" c SET "fecha_inicio_ventas" = '2026-08-14', "fecha_cierre_ventas" = '2026-09-21'
FROM "programs" p
WHERE c."program_id" = p."id" AND p."slug" = 'comunicarte' AND c."codigo" = 'C2';--> statement-breakpoint
UPDATE "cohorts" c SET "fecha_inicio_ventas" = '2026-08-19'
FROM "programs" p
WHERE c."program_id" = p."id" AND p."slug" = 'tactical-investor' AND c."codigo" = 'C2';--> statement-breakpoint
-- Cualquier otra cohorte activa que no tenga inicio de ventas (bases sembradas de otra forma)
-- cae en el cierre de ventas, para que el CHECK de abajo no falle al crearse. Las cerradas y
-- futuras se quedan sin dato a proposito: nadie sabe cuando empezaron a vender.
UPDATE "cohorts" SET "fecha_inicio_ventas" = "fecha_cierre_ventas"
WHERE "estado" = 'activo' AND "fecha_inicio_ventas" IS NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_activa_con_inicio_ventas" CHECK ("cohorts"."estado" <> 'activo' OR "cohorts"."fecha_inicio_ventas" IS NOT NULL);
