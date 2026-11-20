SET lock_timeout = '5s';
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM abonos WHERE linea_id IS NULL) THEN
    RAISE EXCEPTION 'Migracion 0154: quedaron abonos sin linea despues del backfill';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "abonos" ALTER COLUMN "linea_id" SET NOT NULL;
