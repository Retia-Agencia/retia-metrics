SET lock_timeout = '5s';
--> statement-breakpoint
CREATE TABLE "deal_lineas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"program_id" uuid NOT NULL,
	"sku_id" uuid NOT NULL,
	"precio_lista_usd" numeric(10, 2) NOT NULL,
	"valor_vendido_usd" numeric(10, 2) NOT NULL,
	"asignada_por" uuid,
	"asignada_en" timestamp with time zone DEFAULT now() NOT NULL,
	"anulada_en" timestamp with time zone,
	"anulada_por" uuid,
	CONSTRAINT "deal_lineas_id_programa_uq" UNIQUE("id","program_id"),
	CONSTRAINT "deal_lineas_valor_vendido_no_negativo" CHECK ("deal_lineas"."valor_vendido_usd" >= 0),
	CONSTRAINT "deal_lineas_anulacion_completa" CHECK (("deal_lineas"."anulada_en" IS NULL AND "deal_lineas"."anulada_por" IS NULL)
          OR ("deal_lineas"."anulada_en" IS NOT NULL AND "deal_lineas"."anulada_por" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "productos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"nombre" text NOT NULL,
	"slug" text NOT NULL,
	"cuenta_como_cupo" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "productos_id_programa_uq" UNIQUE("id","program_id")
);
--> statement-breakpoint
CREATE TABLE "skus" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"producto_id" uuid NOT NULL,
	"cohort_id" uuid NOT NULL,
	"codigo" text NOT NULL,
	"precio_lista_usd" numeric(10, 2) NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "skus_id_programa_uq" UNIQUE("id","program_id")
);
--> statement-breakpoint
ALTER TABLE "abonos" ADD COLUMN "linea_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_lineas" ADD CONSTRAINT "deal_lineas_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_lineas" ADD CONSTRAINT "deal_lineas_asignada_por_users_id_fk" FOREIGN KEY ("asignada_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_lineas" ADD CONSTRAINT "deal_lineas_anulada_por_users_id_fk" FOREIGN KEY ("anulada_por") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_lineas" ADD CONSTRAINT "deal_lineas_deal_programa_fk" FOREIGN KEY ("deal_id","program_id") REFERENCES "public"."deals"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_lineas" ADD CONSTRAINT "deal_lineas_sku_programa_fk" FOREIGN KEY ("sku_id","program_id") REFERENCES "public"."skus"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "productos" ADD CONSTRAINT "productos_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_producto_programa_fk" FOREIGN KEY ("producto_id","program_id") REFERENCES "public"."productos"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skus" ADD CONSTRAINT "skus_cohorte_programa_fk" FOREIGN KEY ("cohort_id","program_id") REFERENCES "public"."cohorts"("id","program_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "deal_lineas_deal_idx" ON "deal_lineas" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "deal_lineas_sku_idx" ON "deal_lineas" USING btree ("sku_id");--> statement-breakpoint
CREATE UNIQUE INDEX "productos_programa_slug_idx" ON "productos" USING btree ("program_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "skus_codigo_idx" ON "skus" USING btree ("codigo");--> statement-breakpoint
CREATE UNIQUE INDEX "skus_producto_cohorte_idx" ON "skus" USING btree ("producto_id","cohort_id");--> statement-breakpoint
ALTER TABLE "abonos" ADD CONSTRAINT "abonos_linea_programa_fk" FOREIGN KEY ("linea_id","program_id") REFERENCES "public"."deal_lineas"("id","program_id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "productos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "skus" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "deal_lineas" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM abonos a JOIN deals d ON d.id = a.deal_id WHERE a.concepto = 'ticket' AND d.cohort_id IS NULL) THEN
    RAISE EXCEPTION 'Migracion 0153: hay abonos ticket sobre deals sin cohorte; asigne la cohorte antes de migrar';
  END IF;
  IF EXISTS (SELECT 1 FROM abonos a JOIN deals d ON d.id = a.deal_id WHERE a.concepto = 'adicional' AND d.cohort_id IS NULL) THEN
    RAISE EXCEPTION 'Migracion 0153: hay abonos adicionales sobre deals sin cohorte; asigne la cohorte antes de migrar';
  END IF;
  IF EXISTS (SELECT 1 FROM abonos WHERE concepto = 'adicional' AND moneda <> 'USD') THEN
    RAISE EXCEPTION 'Migracion 0153: hay abonos adicionales en moneda distinta de USD y no existe una regla de conversion';
  END IF;
END $$;
--> statement-breakpoint
INSERT INTO productos (program_id, nombre, slug, cuenta_como_cupo)
SELECT id, 'Programa virtual', 'programa_virtual', true FROM programs;
--> statement-breakpoint
INSERT INTO skus (program_id, producto_id, cohort_id, codigo, precio_lista_usd)
SELECT c.program_id, p.id, c.id, replace(pr.slug, '-', '_') || '_programa_virtual_' || lower(c.codigo), c.precio_usd
FROM cohorts c
JOIN programs pr ON pr.id = c.program_id
JOIN productos p ON p.program_id = c.program_id AND p.slug = 'programa_virtual';
--> statement-breakpoint
INSERT INTO productos (program_id, nombre, slug, cuenta_como_cupo)
SELECT DISTINCT d.program_id, 'Sin clasificar', 'sin_clasificar', false
FROM abonos a JOIN deals d ON d.id = a.deal_id AND d.program_id = a.program_id
WHERE a.concepto = 'adicional';
--> statement-breakpoint
INSERT INTO skus (program_id, producto_id, cohort_id, codigo, precio_lista_usd)
SELECT DISTINCT d.program_id, p.id, d.cohort_id, replace(pr.slug, '-', '_') || '_sin_clasificar_' || lower(c.codigo), 0
FROM abonos a
JOIN deals d ON d.id = a.deal_id AND d.program_id = a.program_id
JOIN cohorts c ON c.id = d.cohort_id AND c.program_id = d.program_id
JOIN programs pr ON pr.id = d.program_id
JOIN productos p ON p.program_id = d.program_id AND p.slug = 'sin_clasificar'
WHERE a.concepto = 'adicional';
--> statement-breakpoint
INSERT INTO deal_lineas (deal_id, program_id, sku_id, precio_lista_usd, valor_vendido_usd, asignada_por, asignada_en)
SELECT d.id, d.program_id, s.id, c.precio_usd, coalesce(d.valor_vendido_usd, c.precio_usd), null, d.created_at
FROM deals d
JOIN cohorts c ON c.id = d.cohort_id AND c.program_id = d.program_id
JOIN productos p ON p.program_id = d.program_id AND p.slug = 'programa_virtual'
JOIN skus s ON s.producto_id = p.id AND s.cohort_id = c.id AND s.program_id = d.program_id;
--> statement-breakpoint
UPDATE abonos a SET linea_id = dl.id
FROM deal_lineas dl
JOIN skus s ON s.id = dl.sku_id AND s.program_id = dl.program_id
JOIN productos p ON p.id = s.producto_id AND p.program_id = s.program_id
WHERE a.concepto = 'ticket' AND dl.deal_id = a.deal_id AND dl.program_id = a.program_id AND p.slug = 'programa_virtual';
--> statement-breakpoint
CREATE TEMPORARY TABLE backfill_lineas_adicionales (
  abono_id uuid PRIMARY KEY,
  linea_id uuid NOT NULL DEFAULT gen_random_uuid()
) ON COMMIT DROP;
--> statement-breakpoint
INSERT INTO backfill_lineas_adicionales (abono_id)
SELECT id FROM abonos WHERE concepto = 'adicional';
--> statement-breakpoint
INSERT INTO deal_lineas (id, deal_id, program_id, sku_id, precio_lista_usd, valor_vendido_usd, asignada_por, asignada_en, anulada_en, anulada_por)
SELECT m.linea_id, a.deal_id, a.program_id, s.id, s.precio_lista_usd, a.monto, null, a.created_at, a.anulado_en, a.anulado_por
FROM abonos a
JOIN backfill_lineas_adicionales m ON m.abono_id = a.id
JOIN deals d ON d.id = a.deal_id AND d.program_id = a.program_id
JOIN productos p ON p.program_id = a.program_id AND p.slug = 'sin_clasificar'
JOIN skus s ON s.producto_id = p.id AND s.cohort_id = d.cohort_id AND s.program_id = a.program_id
WHERE a.concepto = 'adicional';
--> statement-breakpoint
UPDATE abonos a SET linea_id = m.linea_id
FROM backfill_lineas_adicionales m WHERE m.abono_id = a.id;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM abonos WHERE linea_id IS NULL) THEN
    RAISE EXCEPTION 'Migracion 0153: quedaron abonos sin linea despues del backfill';
  END IF;
END $$;
