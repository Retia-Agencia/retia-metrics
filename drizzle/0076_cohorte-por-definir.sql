-- Ticket 227: una cohorte futura puede quedar "por definir" (sin fechas de clases ni cierre de ventas).
-- Aditiva: hoy ninguna fila tiene esas fechas nulas, así que se aplica antes del código y el CHECK no falla.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "cohorts" ALTER COLUMN "fecha_inicio_clases" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ALTER COLUMN "fecha_cierre_ventas" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "cohorts" ADD CONSTRAINT "cohorts_definida_si_no_es_futura" CHECK ("cohorts"."estado" = 'futuro' OR ("cohorts"."fecha_inicio_clases" IS NOT NULL AND "cohorts"."fecha_cierre_ventas" IS NOT NULL));