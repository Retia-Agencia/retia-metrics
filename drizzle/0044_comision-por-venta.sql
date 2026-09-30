SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "comision_por_venta_usd" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_comision_no_negativa" CHECK ("programs"."comision_por_venta_usd" IS NULL OR "programs"."comision_por_venta_usd" >= 0);