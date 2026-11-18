-- 407 fase 1 (ADR 0135): la puerta de lectura del MCP analitico. Un esquema con una vista por hecho, un rol que solo ve
-- esas vistas y un alcance que fija el SERVIDOR dentro de la transaccion, por una funcion que el agente no puede repetir.
-- El rol nace NOLOGIN y sin contrasena: LOGIN y contrasena (y DATABASE_URL_MCP_LECTURA) los fija la sesion padre fuera de aqui.
-- Las comparaciones con enums van como texto: el migrador corre todo en UNA transaccion y un valor agregado por una
-- migracion anterior (ALTER TYPE ... ADD VALUE) no se puede usar como literal ahi (Postgres real lo rechaza; PGlite no).
SET lock_timeout = '5s';--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'mcp_lectura_login') THEN
    CREATE ROLE mcp_lectura_login NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS;
  END IF;
END $$;--> statement-breakpoint
ALTER ROLE mcp_lectura_login SET statement_timeout = '5s';--> statement-breakpoint
ALTER ROLE mcp_lectura_login SET idle_in_transaction_session_timeout = '10s';--> statement-breakpoint
CREATE SCHEMA mcp_lectura;--> statement-breakpoint
REVOKE ALL ON SCHEMA mcp_lectura FROM PUBLIC;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA mcp_lectura REVOKE ALL ON TABLES FROM PUBLIC;--> statement-breakpoint
GRANT USAGE ON SCHEMA mcp_lectura TO mcp_lectura_login;--> statement-breakpoint
DO $$
DECLARE r text;
BEGIN
  -- Supabase concede por defecto a sus roles de la API; este esquema no se expone por ninguna.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA mcp_lectura FROM %I', r);
    END IF;
  END LOOP;
END $$;--> statement-breakpoint
-- El alcance: lo escribe SOLO fijar_alcance (dueña postgres). Una fila por (transaccion, programa) y una fila ancla con el
-- uuid nulo, que es la que impide fijarlo dos veces aunque la persona no tenga programas.
CREATE TABLE mcp_lectura.alcance (
  txid bigint NOT NULL,
  programa_id uuid NOT NULL,
  ve_equipo boolean NOT NULL,
  PRIMARY KEY (txid, programa_id)
);--> statement-breakpoint
CREATE FUNCTION mcp_lectura.fijar_alcance(programas uuid[], p_ve_equipo boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM mcp_lectura.alcance WHERE txid = txid_current()) THEN
    RAISE EXCEPTION 'El alcance de esta transaccion ya esta fijado' USING ERRCODE = '42501';
  END IF;
  INSERT INTO mcp_lectura.alcance (txid, programa_id, ve_equipo)
    VALUES (txid_current(), '00000000-0000-0000-0000-000000000000', p_ve_equipo);
  INSERT INTO mcp_lectura.alcance (txid, programa_id, ve_equipo)
    SELECT DISTINCT txid_current(), p, p_ve_equipo FROM unnest(programas) AS p
    WHERE p <> '00000000-0000-0000-0000-000000000000';
END $$;--> statement-breakpoint
REVOKE ALL ON FUNCTION mcp_lectura.fijar_alcance(uuid[], boolean) FROM PUBLIC;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION mcp_lectura.fijar_alcance(uuid[], boolean) TO mcp_lectura_login;--> statement-breakpoint
-- Gemelas SQL de lib/atribucion/canal-sql.ts (normalizarSql, sourceSql, plataformaSql, areaSql, canalSql, cuentaSql,
-- idEnArbolSql, categoriaUtmSql). tests/mcp-lectura-vistas.test.ts las compara contra esas funciones.
CREATE FUNCTION mcp_lectura.utm_normalizado(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t IS NULL OR btrim(t) = '' OR btrim(t) LIKE '%{{%' THEN NULL ELSE lower(btrim(t)) END
$$;--> statement-breakpoint
CREATE FUNCTION mcp_lectura.utm_fuente(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT regexp_replace(mcp_lectura.utm_normalizado(t), '[[:space:]]+', ' ', 'g')
$$;--> statement-breakpoint
CREATE FUNCTION mcp_lectura.utm_cuenta(source text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN mcp_lectura.utm_fuente(source) IS NULL OR strpos(mcp_lectura.utm_fuente(source), ' ') = 0 THEN NULL
    ELSE substring(mcp_lectura.utm_fuente(source) from strpos(mcp_lectura.utm_fuente(source), ' ') + 1) END
$$;--> statement-breakpoint
CREATE FUNCTION mcp_lectura.utm_canal(source text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN mcp_lectura.utm_fuente(source) IS NULL THEN NULL
    ELSE (CASE split_part(mcp_lectura.utm_fuente(source), ' ', 1)
      WHEN 'ig' THEN 'instagram' WHEN 'fb' THEN 'facebook' WHEN 'an' THEN 'audience network'
      WHEN 'msg' THEN 'messenger' WHEN 'th' THEN 'threads'
      ELSE split_part(mcp_lectura.utm_fuente(source), ' ', 1) END)
      || COALESCE(' ' || mcp_lectura.utm_cuenta(source), '')
  END
$$;--> statement-breakpoint
CREATE FUNCTION mcp_lectura.id_meta_limpio(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN t IS NULL OR btrim(t) = '' OR btrim(t) LIKE '%{{%' THEN NULL ELSE btrim(t) END
$$;--> statement-breakpoint
-- Lee `pauta_objetos`, que el rol de lectura no ve: va como DEFINER y solo contesta por programas dentro del alcance
-- fijado en ESTA transaccion, para no ser un oraculo de ids de otro programa.
CREATE FUNCTION mcp_lectura.id_en_arbol(programa uuid, utm_id text, respuestas jsonb) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT EXISTS (
    SELECT 1 FROM mcp_lectura.alcance al
    JOIN public.pauta_objetos po ON po.program_id = al.programa_id
    WHERE al.txid = txid_current() AND al.programa_id = programa
      AND po.id_meta IN (
        mcp_lectura.id_meta_limpio(coalesce(utm_id, respuestas->>'utm_id')),
        mcp_lectura.id_meta_limpio(respuestas->>'ad_id'),
        mcp_lectura.id_meta_limpio(respuestas->>'adset_id'),
        mcp_lectura.id_meta_limpio(respuestas->>'campaign_id')
      )
  )
$$;--> statement-breakpoint
CREATE FUNCTION mcp_lectura.utm_area(source text, medium text, programa uuid, utm_id text, respuestas jsonb) RETURNS text LANGUAGE sql STABLE AS $$
  SELECT CASE
    WHEN mcp_lectura.id_en_arbol(programa, utm_id, respuestas) THEN 'paid'
    WHEN mcp_lectura.utm_normalizado(medium) IN ('cpc', 'paid_social', 'paid') THEN 'paid'
    WHEN mcp_lectura.utm_normalizado(medium) = 'referido' THEN 'referidos'
    WHEN mcp_lectura.utm_normalizado(source) IS NOT NULL OR mcp_lectura.utm_normalizado(medium) IS NOT NULL THEN 'organico'
    ELSE 'sin_utm'
  END
$$;--> statement-breakpoint
CREATE FUNCTION mcp_lectura.utm_categoria(s text, m text, c text, ct text, tm text, i text) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN s LIKE '%{{%' OR m LIKE '%{{%' OR c LIKE '%{{%' OR ct LIKE '%{{%' OR tm LIKE '%{{%' OR i LIKE '%{{%' THEN 'macro'
    WHEN mcp_lectura.utm_normalizado(s) IS NULL AND mcp_lectura.utm_normalizado(m) IS NULL AND mcp_lectura.utm_normalizado(c) IS NULL THEN 'sin_utm'
    ELSE 'con_utm'
  END
$$;--> statement-breakpoint
-- ───────────────────────────────────────────────────── vistas: una por hecho (security_barrier: ningun predicado del agente
-- se evalua antes del cruce con el alcance). Dia = dia de Bogota. Dueño y registrador salen nulos si el rol no ve al equipo.
CREATE VIEW mcp_lectura.programas WITH (security_barrier = true) AS
SELECT p.id AS programa_id, p.slug AS programa, p.nombre
FROM public.programs p
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = p.id;--> statement-breakpoint
CREATE VIEW mcp_lectura.envios WITH (security_barrier = true) AS
SELECT s.id AS id_del_envio, so.program_id AS programa_id, p.slug AS programa,
  f.dia, date_trunc('week', f.dia::timestamp)::date AS semana, date_trunc('month', f.dia::timestamp)::date AS mes,
  mcp_lectura.utm_area(s.utm_source, s.utm_medium, so.program_id, s.utm_id, s.respuestas) AS area,
  mcp_lectura.utm_canal(s.utm_source) AS canal,
  mcp_lectura.utm_cuenta(s.utm_source) AS cuenta,
  CASE WHEN s.es_parcial THEN 'parcial' ELSE 'completo' END AS tipo,
  s.utm_campaign AS campana, s.source_id AS fuente_id, s.utm_source, s.utm_medium, s.utm_content, s.utm_term,
  mcp_lectura.utm_categoria(s.utm_source, s.utm_medium, s.utm_campaign, s.utm_content, s.utm_term, s.utm_id) AS categoria,
  s.lead_id AS id_del_lead, l.email_normalizado AS correo, coalesce(l.nombre, s.nombre) AS nombre,
  (NOT s.es_parcial AND row_number() OVER (PARTITION BY so.program_id, l.email_normalizado, s.es_parcial ORDER BY f.dia, s.created_at, s.id) = 1) AS es_primer_envio_del_correo
FROM public.submissions s
JOIN public.sources so ON so.id = s.source_id
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = so.program_id
JOIN public.programs p ON p.id = so.program_id
LEFT JOIN public.leads l ON l.id = s.lead_id
CROSS JOIN LATERAL (SELECT (coalesce(s.fecha_envio, s.created_at) AT TIME ZONE 'America/Bogota')::date AS dia) f
-- Un parcial de alguien que despues completo (mismo source y token) no cuenta aparte.
WHERE NOT (s.es_parcial AND EXISTS (
  SELECT 1 FROM public.submissions c WHERE c.source_id = s.source_id AND c.token = s.token AND c.es_parcial = false));--> statement-breakpoint
CREATE VIEW mcp_lectura.agendas WITH (security_barrier = true) AS
SELECT c.id AS id_de_la_llamada, c.deal_id AS id_del_deal, c.program_id AS programa_id, p.slug AS programa,
  f.dia, date_trunc('week', f.dia::timestamp)::date AS semana, date_trunc('month', f.dia::timestamp)::date AS mes,
  f.hora, f.hora_minuto,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_area(s.utm_source, s.utm_medium, c.program_id, s.utm_id, s.respuestas) END AS area,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_canal(s.utm_source) END AS canal,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_cuenta(s.utm_source) END AS cuenta,
  s.utm_source, s.utm_medium,
  mcp_lectura.utm_categoria(s.utm_source, s.utm_medium, s.utm_campaign, s.utm_content, s.utm_term, s.utm_id) AS categoria,
  CASE WHEN s.id IS NULL THEN 'no' ELSE 'si' END AS tiene_envio,
  CASE WHEN s.id IS NOT NULL AND mcp_lectura.utm_area(s.utm_source, s.utm_medium, c.program_id, s.utm_id, s.respuestas) = 'paid' THEN 'si' ELSE 'no' END AS universo_paid,
  CASE WHEN al.ve_equipo THEN d.owner_user_id END AS dueno,
  CASE WHEN al.ve_equipo THEN u.nombre END AS dueno_nombre,
  d.cohort_id AS cohorte_id, co.codigo AS cohorte, d.etapa::text AS etapa,
  c.resultado::text AS resultado, l.email_normalizado AS correo, l.nombre AS nombre
FROM public.calls c
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = c.program_id
JOIN public.programs p ON p.id = c.program_id
LEFT JOIN public.deals d ON d.id = c.deal_id
LEFT JOIN public.submissions s ON s.id = d.submission_origen_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.users u ON u.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
CROSS JOIN LATERAL (SELECT (c.created_at AT TIME ZONE 'America/Bogota')::date AS dia,
  to_char(c.created_at AT TIME ZONE 'America/Bogota', 'HH24') AS hora,
  to_char(c.created_at AT TIME ZONE 'America/Bogota', 'HH24:MI') AS hora_minuto) f
WHERE c.anulado_en IS NULL AND (d.id IS NULL OR d.anulado_en IS NULL);--> statement-breakpoint
CREATE VIEW mcp_lectura.citas WITH (security_barrier = true) AS
SELECT c.id AS id_de_la_llamada, c.deal_id AS id_del_deal, c.program_id AS programa_id, p.slug AS programa,
  f.dia, date_trunc('week', f.dia::timestamp)::date AS semana, date_trunc('month', f.dia::timestamp)::date AS mes,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_area(s.utm_source, s.utm_medium, c.program_id, s.utm_id, s.respuestas) END AS area,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_canal(s.utm_source) END AS canal,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_cuenta(s.utm_source) END AS cuenta,
  CASE WHEN s.id IS NOT NULL AND mcp_lectura.utm_area(s.utm_source, s.utm_medium, c.program_id, s.utm_id, s.respuestas) = 'paid' THEN 'si' ELSE 'no' END AS universo_paid,
  CASE WHEN al.ve_equipo THEN d.owner_user_id END AS dueno,
  CASE WHEN al.ve_equipo THEN u.nombre END AS dueno_nombre,
  d.cohort_id AS cohorte_id, co.codigo AS cohorte, d.etapa::text AS etapa,
  c.resultado::text AS resultado,
  CASE WHEN c.resultado::text IN ('show', 'compromiso_pago', 'cerrada', 'perdida') THEN 'si' ELSE 'no' END AS ocurrio,
  l.email_normalizado AS correo, l.nombre AS nombre
FROM public.calls c
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = c.program_id
JOIN public.programs p ON p.id = c.program_id
LEFT JOIN public.deals d ON d.id = c.deal_id
LEFT JOIN public.submissions s ON s.id = d.submission_origen_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.users u ON u.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
CROSS JOIN LATERAL (SELECT (coalesce(c.fecha_agenda, c.fecha_llamada) AT TIME ZONE 'America/Bogota')::date AS dia) f
WHERE c.anulado_en IS NULL AND (d.id IS NULL OR d.anulado_en IS NULL);--> statement-breakpoint
-- La venta se fecha por el dia del PRIMER PAGO (abono vigente mas antiguo, Bogota); sin abono, por el dia de la etapa.
CREATE VIEW mcp_lectura.ventas WITH (security_barrier = true) AS
SELECT d.id AS id_del_deal, d.lead_id AS id_del_lead, d.program_id AS programa_id, p.slug AS programa,
  f.dia, date_trunc('week', f.dia::timestamp)::date AS semana, date_trunc('month', f.dia::timestamp)::date AS mes,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_area(s.utm_source, s.utm_medium, d.program_id, s.utm_id, s.respuestas) END AS area,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_canal(s.utm_source) END AS canal,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_cuenta(s.utm_source) END AS cuenta,
  CASE WHEN al.ve_equipo THEN d.owner_user_id END AS dueno,
  CASE WHEN al.ve_equipo THEN u.nombre END AS dueno_nombre,
  d.cohort_id AS cohorte_id, co.codigo AS cohorte, d.etapa::text AS etapa,
  d.valor_vendido_usd, f.dia AS dia_de_venta, e.dia_de_etapa, l.email_normalizado AS correo, l.nombre AS nombre
FROM (
  SELECT h.deal_id, min(h.fecha) AS fecha_venta
  FROM public.deal_etapa_historial h
  WHERE h.a::text IN ('ganado_parcial', 'ganado_completo')
    AND NOT EXISTS (
      SELECT 1 FROM public.deal_etapa_historial r
      WHERE r.deal_id = h.deal_id
        AND r.de::text IN ('ganado_parcial', 'ganado_completo')
        AND r.a::text IN ('potencial', 'registrado', 'en_gestion', 'contactado', 'calificado', 'agendado', 'atendido', 'compromiso_verbal')
        AND r.fecha > h.fecha)
  GROUP BY h.deal_id
) v
JOIN public.deals d ON d.id = v.deal_id AND d.cortesia = false AND d.etapa::text IN ('ganado_parcial', 'ganado_completo') AND d.anulado_en IS NULL
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.program_id
JOIN public.programs p ON p.id = d.program_id
LEFT JOIN public.submissions s ON s.id = d.submission_origen_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.users u ON u.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
CROSS JOIN LATERAL (SELECT (v.fecha_venta AT TIME ZONE 'America/Bogota')::date AS dia_de_etapa) e
CROSS JOIN LATERAL (SELECT min(a.fecha) AS primer_pago FROM public.abonos a WHERE a.deal_id = d.id AND a.anulado_en IS NULL AND a.concepto = 'ticket') pp
CROSS JOIN LATERAL (SELECT coalesce(pp.primer_pago, e.dia_de_etapa) AS dia) f;--> statement-breakpoint
CREATE VIEW mcp_lectura.abonos WITH (security_barrier = true) AS
SELECT a.id AS id_del_abono, a.deal_id AS id_del_deal, a.program_id AS programa_id, p.slug AS programa,
  a.fecha AS dia, date_trunc('week', a.fecha::timestamp)::date AS semana, date_trunc('month', a.fecha::timestamp)::date AS mes,
  a.moneda, a.monto, a.concepto::text AS concepto, a.plataforma_id AS plataforma,
  CASE WHEN al.ve_equipo THEN a.registrado_por_user_id END AS registrado_por,
  CASE WHEN al.ve_equipo THEN ur.nombre END AS registrado_por_nombre,
  CASE WHEN al.ve_equipo THEN d.owner_user_id END AS dueno,
  CASE WHEN al.ve_equipo THEN uo.nombre END AS dueno_nombre,
  d.cohort_id AS cohorte_id, co.codigo AS cohorte, d.etapa::text AS etapa_del_deal,
  (d.anulado_en IS NULL) AS deal_vigente, l.email_normalizado AS correo, l.nombre AS nombre
FROM public.abonos a
JOIN public.deals d ON d.id = a.deal_id
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = a.program_id
JOIN public.programs p ON p.id = a.program_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.users ur ON ur.id = a.registrado_por_user_id
LEFT JOIN public.users uo ON uo.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
WHERE a.anulado_en IS NULL;--> statement-breakpoint
CREATE VIEW mcp_lectura.gasto WITH (security_barrier = true) AS
SELECT g.id AS id_del_gasto, g.program_id AS programa_id, p.slug AS programa,
  g.fecha AS dia, date_trunc('week', g.fecha::timestamp)::date AS semana, date_trunc('month', g.fecha::timestamp)::date AS mes,
  g.moneda, g.monto, g.pauta_objeto_id AS objeto_de_pauta, po.cuenta_id AS cuenta_meta,
  po.id_meta, po.nombre AS objeto_nombre, po.nivel::text AS nivel,
  g.impresiones, g.alcance, g.clics_enlace, g.vistas_landing, g.registros_meta, g.agendas_meta
FROM public.gasto_pauta g
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = g.program_id
JOIN public.programs p ON p.id = g.program_id
LEFT JOIN public.pauta_objetos po ON po.id = g.pauta_objeto_id
WHERE g.area = 'paid' OR g.pauta_objeto_id IS NOT NULL;--> statement-breakpoint
CREATE VIEW mcp_lectura.leads WITH (security_barrier = true) AS
SELECT l.id AS id_del_lead, l.program_id AS programa_id, p.slug AS programa,
  l.email_normalizado AS correo, l.nombre, l.telefono, l.entrada::text AS entrada,
  (l.entrada::text = 'formulario') AS cuenta_como_lead,
  (l.fecha_primera_aplicacion AT TIME ZONE 'America/Bogota')::date AS dia_primera_aplicacion,
  (CASE WHEN l.entrada::text = 'formulario' THEN l.fecha_primera_aplicacion ELSE l.created_at END AT TIME ZONE 'America/Bogota')::date AS dia_de_entrada,
  l.num_aplicaciones, l.calificacion, l.puntaje, l.lead_quality, l.lead_value,
  CASE WHEN al.ve_equipo THEN l.traido_por_user_id END AS traido_por
FROM public.leads l
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = l.program_id
JOIN public.programs p ON p.id = l.program_id;--> statement-breakpoint
CREATE VIEW mcp_lectura.deals WITH (security_barrier = true) AS
SELECT d.id AS id_del_deal, d.lead_id AS id_del_lead, d.program_id AS programa_id, p.slug AS programa,
  d.etapa::text AS etapa, d.pendiente::text AS pendiente,
  (d.etapa::text IN ('ganado_parcial', 'ganado_completo')) AS etapa_vendida, d.cortesia,
  (coalesce(s.fecha_envio, s.created_at, d.created_at) AT TIME ZONE 'America/Bogota')::date AS dia_de_creacion,
  CASE WHEN al.ve_equipo THEN d.owner_user_id END AS dueno,
  CASE WHEN al.ve_equipo THEN u.nombre END AS dueno_nombre,
  d.cohort_id AS cohorte_id, co.codigo AS cohorte, d.valor_vendido_usd, d.fecha_limite_pago,
  l.email_normalizado AS correo, l.nombre AS nombre, l.telefono
FROM public.deals d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.program_id
JOIN public.programs p ON p.id = d.program_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.submissions s ON s.id = d.submission_origen_id
LEFT JOIN public.users u ON u.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
WHERE d.anulado_en IS NULL;--> statement-breakpoint
GRANT SELECT ON mcp_lectura.programas, mcp_lectura.envios, mcp_lectura.agendas, mcp_lectura.citas, mcp_lectura.ventas,
  mcp_lectura.abonos, mcp_lectura.gasto, mcp_lectura.leads, mcp_lectura.deals TO mcp_lectura_login;
