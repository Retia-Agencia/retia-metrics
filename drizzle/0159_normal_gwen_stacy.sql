SET lock_timeout = '5s';
--> statement-breakpoint
ALTER TABLE "deal_lineas" ADD COLUMN "comision_porcentaje" numeric(5, 2);--> statement-breakpoint
UPDATE "deal_lineas" AS dl
SET "comision_porcentaje" = CASE
  WHEN s."comision_porcentaje" = 0 THEN 0
  ELSE d."comision_porcentaje"
END
FROM "deals" AS d, "skus" AS s
WHERE d."id" = dl."deal_id"
  AND s."id" = dl."sku_id"
  AND d."comision_porcentaje" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "deal_lineas" ADD CONSTRAINT "deal_lineas_comision_porcentaje_rango" CHECK ("deal_lineas"."comision_porcentaje" IS NULL OR ("deal_lineas"."comision_porcentaje" >= 0 AND "deal_lineas"."comision_porcentaje" <= 100));
