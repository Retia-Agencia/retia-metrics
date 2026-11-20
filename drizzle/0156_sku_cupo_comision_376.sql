SET lock_timeout = '5s';
--> statement-breakpoint
-- ADR 0137, enmienda del 20-nov: el SKU es el objeto completo; cupo y % de comision viven en el.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM productos WHERE slug NOT IN ('programa_virtual', 'sin_clasificar')) THEN
    RAISE EXCEPTION 'Migracion 0156: hay productos distintos de programa_virtual y sin_clasificar; defina su cupo y comision antes de migrar';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "cuenta_como_cupo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "skus" ADD COLUMN "comision_porcentaje" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_comision_porcentaje_rango" CHECK ("skus"."comision_porcentaje" IS NULL OR ("skus"."comision_porcentaje" >= 0 AND "skus"."comision_porcentaje" <= 100));
--> statement-breakpoint
-- El virtual cuenta como cupo y toma el % actual del programa; sin_clasificar, sin cupo y 0 %.
UPDATE skus s SET cuenta_como_cupo = p.cuenta_como_cupo,
  comision_porcentaje = CASE WHEN p.slug = 'sin_clasificar' THEN 0 ELSE pr.comision_porcentaje END
FROM productos p, programs pr
WHERE p.id = s.producto_id AND pr.id = s.program_id;
--> statement-breakpoint
ALTER TABLE "productos" DROP COLUMN "cuenta_como_cupo";
--> statement-breakpoint
-- Los adicionales de ComunicArte son el 1:1 con Rosario (3 lineas de 1431 USD el 20-nov): pasan de
-- sin_clasificar a su producto real, sin cupo y sin comision ("los 1:1 no tienen comision por ahora").
INSERT INTO productos (program_id, nombre, slug)
SELECT DISTINCT p.program_id, '1:1 con Rosario', '1_1_con_rosario'
FROM productos p JOIN programs pr ON pr.id = p.program_id
WHERE pr.slug = 'comunicarte' AND p.slug = 'sin_clasificar';
--> statement-breakpoint
INSERT INTO skus (program_id, producto_id, cohort_id, codigo, precio_lista_usd, cuenta_como_cupo, comision_porcentaje)
SELECT s.program_id, r.id, s.cohort_id, 'comunicarte_1_1_con_rosario_' || lower(c.codigo), 1431.00, false, 0
FROM skus s
JOIN productos p ON p.id = s.producto_id AND p.slug = 'sin_clasificar'
JOIN programs pr ON pr.id = s.program_id AND pr.slug = 'comunicarte'
JOIN cohorts c ON c.id = s.cohort_id AND c.program_id = s.program_id
JOIN productos r ON r.program_id = s.program_id AND r.slug = '1_1_con_rosario';
--> statement-breakpoint
UPDATE deal_lineas dl SET sku_id = rs.id, precio_lista_usd = rs.precio_lista_usd
FROM skus s
JOIN productos p ON p.id = s.producto_id AND p.slug = 'sin_clasificar'
JOIN programs pr ON pr.id = s.program_id AND pr.slug = 'comunicarte'
JOIN productos r ON r.program_id = s.program_id AND r.slug = '1_1_con_rosario'
JOIN skus rs ON rs.producto_id = r.id AND rs.cohort_id = s.cohort_id
WHERE dl.sku_id = s.id;
--> statement-breakpoint
-- Sin lineas, el sin_clasificar de ComunicArte ya no describe nada: sale del catalogo.
DELETE FROM skus s USING productos p, programs pr
WHERE p.id = s.producto_id AND p.slug = 'sin_clasificar' AND pr.id = s.program_id AND pr.slug = 'comunicarte'
  AND NOT EXISTS (SELECT 1 FROM deal_lineas dl WHERE dl.sku_id = s.id);
--> statement-breakpoint
DELETE FROM productos p USING programs pr
WHERE pr.id = p.program_id AND pr.slug = 'comunicarte' AND p.slug = 'sin_clasificar'
  AND NOT EXISTS (SELECT 1 FROM skus s WHERE s.producto_id = p.id);
