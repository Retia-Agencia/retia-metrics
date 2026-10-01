SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "comision_porcentaje" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "comision_porcentaje" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_comision_porcentaje_rango" CHECK ("deals"."comision_porcentaje" IS NULL OR ("deals"."comision_porcentaje" >= 0 AND "deals"."comision_porcentaje" <= 100));--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_comision_porcentaje_rango" CHECK ("programs"."comision_porcentaje" IS NULL OR ("programs"."comision_porcentaje" >= 0 AND "programs"."comision_porcentaje" <= 100));
