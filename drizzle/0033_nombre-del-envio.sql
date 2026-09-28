ALTER TABLE "submissions" ADD COLUMN "nombre" text;--> statement-breakpoint
-- Relleno de lo que ya entro (28-sep: 3 envios por webhook, sin nombre). La pregunta del
-- nombre se reconoce por su titulo, igual que el mapeo por defecto: contiene "nombre
-- completo", sin mayusculas. Un titulo que no case se queda nulo, no se adivina.
UPDATE "submissions" s
SET "nombre" = nullif(btrim(r.value), '')
FROM (
  SELECT DISTINCT ON (x.id) x.id, e.value
  FROM "submissions" x, jsonb_each_text(x."respuestas") e
  WHERE lower(e.key) LIKE '%nombre completo%'
  ORDER BY x.id, e.key
) r
WHERE s."id" = r.id AND s."nombre" IS NULL;--> statement-breakpoint
-- El lead toma el nombre del envio completo mas reciente que lo tenga. Solo donde el lead
-- no tiene nombre: uno creado a mano en el CRM conserva el suyo.
UPDATE "leads" l
SET "nombre" = u."nombre"
FROM (
  SELECT DISTINCT ON (s."lead_id") s."lead_id", s."nombre"
  FROM "submissions" s
  WHERE s."lead_id" IS NOT NULL AND s."nombre" IS NOT NULL AND NOT s."es_parcial"
  ORDER BY s."lead_id", s."fecha_envio" DESC NULLS LAST, s."created_at" DESC
) u
WHERE l."id" = u."lead_id" AND l."nombre" IS NULL;
