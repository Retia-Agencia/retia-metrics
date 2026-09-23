-- ADR 0047 punto 5: nada de la base es publico.
--
-- Supabase publica las tablas de `public` por REST (la Data API) y le da SELECT, INSERT,
-- UPDATE y DELETE sobre ellas a los roles `anon` y `authenticated`. La app no usa esa API:
-- entra como `postgres` por el pooler. Medido en `dev` el 23-sep, recien migrado: las 25
-- tablas eran legibles por `anon`, o sea por cualquiera con la llave publica del proyecto.
--
-- Dos cierres, porque la Data API se puede volver a prender desde el dashboard sin que el
-- repo se entere:
--   1. RLS activo y SIN politicas en todas las tablas: `anon` y `authenticated` no ven una
--      sola fila. `postgres` es el dueno de las tablas y RLS no aplica al dueno, asi que la
--      app no cambia.
--   2. Se les quitan los permisos a esos dos roles, tambien sobre lo que se cree despues.
--
-- Los roles solo existen en Supabase. En PGlite (los tests) el bloque 2 no hace nada, y el
-- 1 aplica igual: `tests/rls-en-todas-las-tablas.test.ts` exige que ninguna tabla quede sin
-- RLS, incluidas las que traigan migraciones futuras.

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  rol text;
BEGIN
  FOREACH rol IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = rol) THEN
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', rol);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', rol);
      EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', rol);
    END IF;
  END LOOP;
END $$;
