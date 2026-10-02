SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "programs" DROP CONSTRAINT "programs_comision_no_negativa";--> statement-breakpoint
ALTER TABLE "programs" DROP COLUMN "comision_por_venta_usd";
