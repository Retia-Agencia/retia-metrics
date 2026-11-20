SET lock_timeout = '5s';
--> statement-breakpoint
-- ADR 0139: el nombre vive en el SKU (sin tabla de productos); producto_id sale en el 463.
ALTER TABLE "skus" ALTER COLUMN "producto_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "nombre" text;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "slug" text;--> statement-breakpoint
-- Backfill: cada SKU toma el nombre y el slug de su producto (el slug del producto ya esta normalizado).
UPDATE skus s SET nombre = p.nombre, slug = p.slug
FROM productos p
WHERE p.id = s.producto_id AND p.program_id = s.program_id;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM skus WHERE nombre IS NULL OR slug IS NULL) THEN
    RAISE EXCEPTION 'Migracion 0157: hay SKUs sin producto del que tomar nombre y slug';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "skus" ALTER COLUMN "nombre" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "skus" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "skus_programa_slug_cohorte_idx" ON "skus" USING btree ("program_id","slug","cohort_id");
