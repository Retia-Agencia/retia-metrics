-- Ticket 142: las once etapas de 30X y los Pendientes del deal (ADR 0069 a 0072).
-- Reescrita a mano sobre el borrador de drizzle-kit, que casteaba los valores viejos al
-- enum nuevo y fallaba. El camino: las columnas pasan a texto, se traducen los datos, y
-- recien ahi se crea el tipo nuevo. Ninguna fila se reescribe a mano: todo sale de la
-- etapa vieja, del historial y del envio de origen del deal.
SET lock_timeout = '5s';--> statement-breakpoint
CREATE TYPE "public"."pendiente_deal" AS ENUM('reagenda', 'seguimiento', 'proxima_cohorte');--> statement-breakpoint
ALTER TYPE "public"."tipo_actividad" ADD VALUE 'intento';--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ADD COLUMN "pendiente_de" "pendiente_deal";--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ADD COLUMN "pendiente_a" "pendiente_deal";--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "pendiente" "pendiente_deal";--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "cortesia" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- El indice del cupo nombra 'completo': se quita ANTES de traducir, o un deal que pasa de
-- 'completo' a 'ganado_completo' entraria al indice a mitad de camino.
DROP INDEX "deals_uno_abierto_por_lead_y_programa_idx";--> statement-breakpoint
ALTER TABLE "estados_llegada" DROP CONSTRAINT "estados_llegada_etapa_de_entrada";--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "etapa" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ALTER COLUMN "de" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ALTER COLUMN "a" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "etapa" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "estados_llegada" ALTER COLUMN "etapa_entrada" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."etapa_deal";--> statement-breakpoint
-- La puerta de entrada de cada deal (ADR 0069, la regla de 30X) sale de su envio de
-- origen: High (parcial o completo) -> Calificado; parcial sin High -> Potencial;
-- completo sin High (Low, Mid o sin calidad) -> Registrado. Sin envio -> Registrado.
-- Reemplaza a 'pendiente_setteo' en el deal y en su historial.
CREATE TEMP TABLE "puerta_142" AS
  SELECT d."id" AS "deal_id",
    CASE
      WHEN lower(trim(s."lead_quality")) = 'high' THEN 'calificado'
      WHEN s."es_parcial" THEN 'potencial'
      ELSE 'registrado'
    END AS "puerta"
  FROM "deals" d
  LEFT JOIN "submissions" s ON s."id" = d."submission_origen_id";--> statement-breakpoint
-- El historial, fila por fila y en orden. Una fila que entraba a Re-agenda, Seguimiento
-- o Proxima Cohorte pasa a la ULTIMA etapa real del deal hasta ahi, con el pendiente en
-- su columna (ADR 0070, Consecuencias). El `de` de cada fila es el `a` traducido de la
-- anterior, y su pendiente de antes, el pendiente de despues de la anterior.
CREATE TEMP TABLE "historial_142" AS
  WITH "base" AS (
    SELECT h."id", h."deal_id", h."fecha",
      CASE h."a"
        WHEN 'pendiente_setteo' THEN p."puerta"
        WHEN 'en_contacto' THEN 'contactado'
        WHEN 'abonado' THEN 'ganado_parcial'
        WHEN 'completo' THEN 'ganado_completo'
        WHEN 'pendiente_reagenda' THEN NULL
        WHEN 'seguimiento' THEN NULL
        WHEN 'proxima_cohorte' THEN NULL
        ELSE h."a"
      END AS "a_real",
      CASE h."a"
        WHEN 'pendiente_reagenda' THEN 'reagenda'
        WHEN 'seguimiento' THEN 'seguimiento'
        WHEN 'proxima_cohorte' THEN 'proxima_cohorte'
      END AS "pend",
      p."puerta",
      count(*) FILTER (WHERE h."a" NOT IN ('pendiente_reagenda', 'seguimiento', 'proxima_cohorte'))
        OVER (PARTITION BY h."deal_id" ORDER BY h."fecha", h."id") AS "grupo",
      row_number() OVER (PARTITION BY h."deal_id" ORDER BY h."fecha", h."id") AS "orden"
    FROM "deal_etapa_historial" h
    JOIN "puerta_142" p ON p."deal_id" = h."deal_id"
  ),
  "resuelto" AS (
    SELECT "id", "deal_id", "fecha", "orden", "pend",
      coalesce(
        max("a_real") OVER (PARTITION BY "deal_id", "grupo"),
        "puerta"
      ) AS "a_nueva"
    FROM "base"
  )
  SELECT "id", "deal_id", "orden", "a_nueva", "pend" AS "pendiente_a",
    CASE WHEN "orden" = 1 THEN NULL
      ELSE lag("a_nueva") OVER (PARTITION BY "deal_id" ORDER BY "orden") END AS "de_nueva",
    lag("pend") OVER (PARTITION BY "deal_id" ORDER BY "orden") AS "pendiente_de"
  FROM "resuelto";--> statement-breakpoint
UPDATE "deal_etapa_historial" h SET
  "a" = t."a_nueva",
  "de" = t."de_nueva",
  "pendiente_a" = t."pendiente_a"::"pendiente_deal",
  "pendiente_de" = t."pendiente_de"::"pendiente_deal"
FROM "historial_142" t
WHERE t."id" = h."id";--> statement-breakpoint
-- El deal queda donde dice la ULTIMA fila de su historial ya traducida, con su pendiente.
UPDATE "deals" d SET
  "etapa" = t."a_nueva",
  "pendiente" = t."pendiente_a"::"pendiente_deal"
FROM "historial_142" t
WHERE t."deal_id" = d."id"
  AND t."orden" = (SELECT max(u."orden") FROM "historial_142" u WHERE u."deal_id" = d."id");--> statement-breakpoint
-- Un deal sin historial (no deberia haber: abrirDeal siempre escribe la primera fila) se
-- traduce por su etapa sola.
UPDATE "deals" d SET
  "etapa" = CASE d."etapa"
    WHEN 'pendiente_setteo' THEN p."puerta"
    WHEN 'en_contacto' THEN 'contactado'
    WHEN 'abonado' THEN 'ganado_parcial'
    WHEN 'completo' THEN 'ganado_completo'
    WHEN 'pendiente_reagenda' THEN 'agendado'
    WHEN 'seguimiento' THEN 'atendido'
    WHEN 'proxima_cohorte' THEN p."puerta"
    ELSE d."etapa"
  END,
  "pendiente" = CASE d."etapa"
    WHEN 'pendiente_reagenda' THEN 'reagenda'::"pendiente_deal"
    WHEN 'seguimiento' THEN 'seguimiento'::"pendiente_deal"
    WHEN 'proxima_cohorte' THEN 'proxima_cohorte'::"pendiente_deal"
  END
FROM "puerta_142" p
WHERE p."deal_id" = d."id"
  AND NOT EXISTS (SELECT 1 FROM "deal_etapa_historial" h WHERE h."deal_id" = d."id");--> statement-breakpoint
-- Estados de llegada (117, se retira con el 117 enmendado): Pendiente Setteo con prioridad
-- alta era el Calificado de 30X, y con prioridad normal, Registrado (ADR 0069, columna "Hoy").
UPDATE "estados_llegada" SET "etapa_entrada" =
  CASE WHEN "prioridad" = 'alta' THEN 'calificado' ELSE 'registrado' END
WHERE "etapa_entrada" = 'pendiente_setteo';--> statement-breakpoint
DROP TABLE "historial_142";--> statement-breakpoint
DROP TABLE "puerta_142";--> statement-breakpoint
CREATE TYPE "public"."etapa_deal" AS ENUM('potencial', 'registrado', 'en_gestion', 'contactado', 'calificado', 'agendado', 'atendido', 'compromiso_verbal', 'ganado_parcial', 'ganado_completo', 'cierre_perdido');--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ALTER COLUMN "de" SET DATA TYPE "public"."etapa_deal" USING "de"::"public"."etapa_deal";--> statement-breakpoint
ALTER TABLE "deal_etapa_historial" ALTER COLUMN "a" SET DATA TYPE "public"."etapa_deal" USING "a"::"public"."etapa_deal";--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "etapa" SET DATA TYPE "public"."etapa_deal" USING "etapa"::"public"."etapa_deal";--> statement-breakpoint
ALTER TABLE "deals" ALTER COLUMN "etapa" SET DEFAULT 'registrado'::"public"."etapa_deal";--> statement-breakpoint
ALTER TABLE "estados_llegada" ALTER COLUMN "etapa_entrada" SET DATA TYPE "public"."etapa_deal" USING "etapa_entrada"::"public"."etapa_deal";--> statement-breakpoint
CREATE UNIQUE INDEX "deals_uno_abierto_por_lead_y_programa_idx" ON "deals" USING btree ("lead_id","program_id") WHERE "deals"."etapa" not in ('ganado_completo', 'cierre_perdido') and "deals"."anulado_en" is null;--> statement-breakpoint
ALTER TABLE "estados_llegada" ADD CONSTRAINT "estados_llegada_etapa_de_entrada" CHECK ("estados_llegada"."etapa_entrada" IS NULL OR "estados_llegada"."etapa_entrada"::text IN ('potencial', 'registrado', 'calificado', 'agendado'));
