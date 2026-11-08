-- 0120 (ticket 391 fase A, M3, ADR 0122): una venta vigente tiene dueño, salvo el deal histórico migrado de la hoja.
-- Las 3 ventas de hoy sin dueño llevan huella_migracion, asi que cumplen sin tocarlas. NOT VALID y luego VALIDATE;
-- lock_timeout por si hay una transaccion larga sobre deals.
SET lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_venta_con_dueno" CHECK ("deals"."anulado_en" IS NOT NULL OR "deals"."etapa" NOT IN ('ganado_parcial', 'ganado_completo') OR "deals"."owner_user_id" IS NOT NULL OR "deals"."huella_migracion" IS NOT NULL) NOT VALID;
--> statement-breakpoint
ALTER TABLE "deals" VALIDATE CONSTRAINT "deals_venta_con_dueno";
