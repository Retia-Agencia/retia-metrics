-- 463 (ADR 0131): retiro del modelo viejo de producto, precio y comision (reemplazado por SKUs y lineas).
-- Respaldo previo: scripts/respaldo-463.ts. Sin CASCADE: la FK y el indice salen primero, en orden.
SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "skus" DROP CONSTRAINT "skus_producto_programa_fk";--> statement-breakpoint
DROP INDEX "skus_producto_cohorte_idx";--> statement-breakpoint
ALTER TABLE "skus" DROP COLUMN "producto_id";--> statement-breakpoint
DROP TABLE "productos";--> statement-breakpoint
ALTER TABLE "deals" DROP CONSTRAINT "deals_comision_porcentaje_rango";--> statement-breakpoint
ALTER TABLE "deals" DROP COLUMN "comision_porcentaje";--> statement-breakpoint
ALTER TABLE "programs" DROP CONSTRAINT "programs_comision_porcentaje_rango";--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "comision_porcentaje";--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "ticket_usd";--> statement-breakpoint
ALTER TABLE "cohorts" DROP COLUMN "precio_usd";
