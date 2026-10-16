-- 272: el disparo de la lectura de Form30x pasa de GitHub Actions a pg_cron (16-oct).
-- El horario de GitHub es "best effort": el 16-oct corrio una vez en 11 h. pg_cron vive en la base
-- y llama POST /api/cron/form30x con pg_net en los minutos 13 y 43 (UTC; lejos de la carga de :00).
--
-- Nada secreto en el repo: la URL y el CRON_SECRET viven en Supabase Vault (`crm_url`,
-- `cron_secret`) y el job los lee en cada corrida, asi que rotar el secreto no toca este job.
-- Si faltan en el Vault, la llamada falla o la ruta responde 401: no se mueve nada,
-- y Webhook Health marca la fuente a las 2 h (0091).
--
-- Solo corre donde existen pg_cron y pg_net (Supabase). PGlite y el Postgres local no los traen:
-- ahi el bloque no hace nada, por eso todo va por EXECUTE.
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_available_extensions WHERE name IN ('pg_cron', 'pg_net')) = 2 THEN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog';
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions';
    -- cron.schedule con nombre reemplaza el job si ya existe: la migracion es idempotente.
    EXECUTE $job$
      SELECT cron.schedule(
        'leer-form30x',
        '13,43 * * * *',
        $cmd$
          SELECT net.http_post(
            url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'crm_url')
                   || '/api/cron/form30x',
            headers := jsonb_build_object(
              'Authorization',
              'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
            ),
            timeout_milliseconds := 60000
          )
        $cmd$
      )
    $job$;
  END IF;
END
$$;
