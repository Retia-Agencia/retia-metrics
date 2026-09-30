SET lock_timeout = '5s';--> statement-breakpoint
ALTER TABLE "submissions" ADD COLUMN "utm_id" text;--> statement-breakpoint
-- Ticket 116: utm_content y utm_term ya llegaban pero vivian en `respuestas` (7.104 envios al
-- 30-sep; utm_id en 82). Se copian a sus columnas desde la MISMA fila, con la regla de
-- `limpiarUtm`: recortado, vacio o el centinela `xxxxx` es NULL, y todo lo demas tal como
-- llego (una macro sin expandir incluida). Solo se llena lo que esta vacio: nunca se
-- reescribe una UTM que ya estaba. `respuestas` no se toca.
UPDATE "submissions" SET
  "utm_id" = coalesce("utm_id", CASE WHEN lower(btrim("respuestas"->>'utm_id')) IN ('', 'xxxxx') THEN NULL ELSE btrim("respuestas"->>'utm_id') END),
  "utm_content" = coalesce("utm_content", CASE WHEN lower(btrim("respuestas"->>'utm_content')) IN ('', 'xxxxx') THEN NULL ELSE btrim("respuestas"->>'utm_content') END),
  "utm_term" = coalesce("utm_term", CASE WHEN lower(btrim("respuestas"->>'utm_term')) IN ('', 'xxxxx') THEN NULL ELSE btrim("respuestas"->>'utm_term') END)
WHERE ("respuestas"->>'utm_id') IS NOT NULL
   OR ("respuestas"->>'utm_content') IS NOT NULL
   OR ("respuestas"->>'utm_term') IS NOT NULL;
