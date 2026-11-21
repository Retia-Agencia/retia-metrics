-- 407 fase 2 (ADR 0135, decision de Mani del 21-nov): UNA definicion por hecho, en SQL y sin alcance. Hasta hoy cada hecho tenia
-- dos: el TypeScript de lib/queries/hechos/* y el SQL de las vistas de mcp_lectura. Ahora la definicion vive en el esquema
-- `crm_definicion` (vigencia, dia de Bogota, area y canal, universo_paid, dedup por correo, todo) y la leen dos puertas:
--   * la app, con su filtro de programa de siempre (lib/queries/hechos/*), y
--   * las vistas de mcp_lectura, que SOLO envuelven la definicion con el alcance de la transaccion y el enmascarado de dueño.
-- El contrato del MCP no cambia: mismas vistas, mismas columnas, mismos nombres, mismo orden.
-- Seguridad: crm_definicion NO se concede a mcp_lectura_login (ni USAGE en el esquema ni SELECT). Las vistas de mcp_lectura son
-- de postgres y leen la definicion con los permisos de su dueña, igual que hoy leen public.*. El agente no puede nombrarla.
-- Las funciones puras (utm_normalizado, utm_canal, utm_cuenta, utm_categoria, id_meta_limpio) siguen siendo las de mcp_lectura
-- (no tocan datos ni alcance, el agente puede llamarlas, y tests/mcp-lectura-vistas.test.ts las compara con canal-sql.ts).
SET lock_timeout = '5s';--> statement-breakpoint
CREATE SCHEMA crm_definicion;--> statement-breakpoint
REVOKE ALL ON SCHEMA crm_definicion FROM PUBLIC;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA crm_definicion REVOKE ALL ON TABLES FROM PUBLIC;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA crm_definicion REVOKE ALL ON FUNCTIONS FROM PUBLIC;--> statement-breakpoint
DO $$
DECLARE r text;
BEGIN
  -- Supabase concede por defecto a sus roles de la API; este esquema no se expone por ninguna.
  FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'service_role', 'mcp_lectura_login'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA crm_definicion FROM %I', r);
    END IF;
  END LOOP;
END $$;--> statement-breakpoint
-- Gemelas SQL de idEnArbolSql y areaSql (lib/atribucion/canal-sql.ts), SIN alcance: la app ya filtra por programa y el
-- MCP filtra por alcance fuera de la definicion. (mcp_lectura.id_en_arbol sigue siendo la que el agente puede llamar, con alcance.)
-- Las vistas de mcp_lectura corren con los permisos de su dueña, PERO las funciones que llaman se revisan con el rol que LLAMA
-- (EXECUTE y el USAGE del esquema donde se resuelve el cuerpo). El rol del MCP no tiene USAGE en crm_definicion ni lee
-- `pauta_objetos`, asi que `utm_area` va como DEFINER (su cuerpo, y `id_en_arbol` dentro, corren como la dueña) y solo ella recibe
-- EXECUTE. Sin USAGE en el esquema el agente no puede nombrarla: no es un oraculo de ids de pauta de otro programa.
CREATE FUNCTION crm_definicion.id_en_arbol(programa uuid, utm_id text, respuestas jsonb) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.pauta_objetos po
    WHERE po.program_id = programa
      AND po.id_meta IN (
        mcp_lectura.id_meta_limpio(coalesce(utm_id, respuestas->>'utm_id')),
        mcp_lectura.id_meta_limpio(respuestas->>'ad_id'),
        mcp_lectura.id_meta_limpio(respuestas->>'adset_id'),
        mcp_lectura.id_meta_limpio(respuestas->>'campaign_id')
      )
  )
$$;--> statement-breakpoint
CREATE FUNCTION crm_definicion.utm_area(source text, medium text, programa uuid, utm_id text, respuestas jsonb) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
  SELECT CASE
    WHEN crm_definicion.id_en_arbol(programa, utm_id, respuestas) THEN 'paid'
    WHEN mcp_lectura.utm_normalizado(medium) IN ('cpc', 'paid_social', 'paid') THEN 'paid'
    WHEN mcp_lectura.utm_normalizado(medium) = 'referido' THEN 'referidos'
    WHEN mcp_lectura.utm_normalizado(source) IS NOT NULL OR mcp_lectura.utm_normalizado(medium) IS NOT NULL THEN 'organico'
    ELSE 'sin_utm'
  END
$$;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION crm_definicion.utm_area(text, text, uuid, text, jsonb) TO mcp_lectura_login;--> statement-breakpoint
-- ─────────────────────────────────────────────── definiciones: una vista por hecho. Dia = dia de Bogota. Sin alcance, sin
-- enmascarado: dueño y registrador salen con su valor real; quien los lee decide quien los ve.
CREATE VIEW crm_definicion.envios AS
SELECT s.id AS id_del_envio, so.program_id AS programa_id, p.slug AS programa,
  f.dia, date_trunc('week', f.dia::timestamp)::date AS semana, date_trunc('month', f.dia::timestamp)::date AS mes,
  crm_definicion.utm_area(s.utm_source, s.utm_medium, so.program_id, s.utm_id, s.respuestas) AS area,
  mcp_lectura.utm_canal(s.utm_source) AS canal,
  mcp_lectura.utm_cuenta(s.utm_source) AS cuenta,
  CASE WHEN s.es_parcial THEN 'parcial' ELSE 'completo' END AS tipo,
  s.utm_campaign AS campana, s.source_id AS fuente_id, s.utm_source, s.utm_medium, s.utm_content, s.utm_term,
  mcp_lectura.utm_categoria(s.utm_source, s.utm_medium, s.utm_campaign, s.utm_content, s.utm_term, s.utm_id) AS categoria,
  s.lead_id AS id_del_lead, l.email_normalizado AS correo, coalesce(l.nombre, s.nombre) AS nombre,
  (NOT s.es_parcial AND row_number() OVER (PARTITION BY so.program_id, l.email_normalizado, s.es_parcial ORDER BY f.dia, s.created_at, s.id) = 1) AS es_primer_envio_del_correo
FROM public.submissions s
JOIN public.sources so ON so.id = s.source_id
JOIN public.programs p ON p.id = so.program_id
LEFT JOIN public.leads l ON l.id = s.lead_id
CROSS JOIN LATERAL (SELECT (coalesce(s.fecha_envio, s.created_at) AT TIME ZONE 'America/Bogota')::date AS dia) f
-- Un parcial de alguien que despues completo (mismo source y token) no cuenta aparte.
WHERE NOT (s.es_parcial AND EXISTS (
  SELECT 1 FROM public.submissions c WHERE c.source_id = s.source_id AND c.token = s.token AND c.es_parcial = false));--> statement-breakpoint
-- `creada_en` no sale por el MCP: es el instante de creacion que usan los cortes «creada hasta» de la app.
CREATE VIEW crm_definicion.agendas AS
SELECT c.id AS id_de_la_llamada, c.deal_id AS id_del_deal, c.program_id AS programa_id, p.slug AS programa,
  f.dia, date_trunc('week', f.dia::timestamp)::date AS semana, date_trunc('month', f.dia::timestamp)::date AS mes,
  f.hora, f.hora_minuto,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE crm_definicion.utm_area(s.utm_source, s.utm_medium, c.program_id, s.utm_id, s.respuestas) END AS area,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_canal(s.utm_source) END AS canal,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_cuenta(s.utm_source) END AS cuenta,
  s.utm_source, s.utm_medium,
  mcp_lectura.utm_categoria(s.utm_source, s.utm_medium, s.utm_campaign, s.utm_content, s.utm_term, s.utm_id) AS categoria,
  CASE WHEN s.id IS NULL THEN 'no' ELSE 'si' END AS tiene_envio,
  CASE WHEN s.id IS NOT NULL AND crm_definicion.utm_area(s.utm_source, s.utm_medium, c.program_id, s.utm_id, s.respuestas) = 'paid' THEN 'si' ELSE 'no' END AS universo_paid,
  d.owner_user_id AS dueno, u.nombre AS dueno_nombre,
  d.cohort_id AS cohorte_id, co.codigo AS cohorte, d.etapa::text AS etapa,
  c.resultado::text AS resultado, l.email_normalizado AS correo, l.nombre AS nombre,
  c.created_at AS creada_en
FROM public.calls c
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
CREATE VIEW crm_definicion.citas AS
SELECT c.id AS id_de_la_llamada, c.deal_id AS id_del_deal, c.program_id AS programa_id, p.slug AS programa,
  f.dia, date_trunc('week', f.dia::timestamp)::date AS semana, date_trunc('month', f.dia::timestamp)::date AS mes,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE crm_definicion.utm_area(s.utm_source, s.utm_medium, c.program_id, s.utm_id, s.respuestas) END AS area,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_canal(s.utm_source) END AS canal,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_cuenta(s.utm_source) END AS cuenta,
  CASE WHEN s.id IS NOT NULL AND crm_definicion.utm_area(s.utm_source, s.utm_medium, c.program_id, s.utm_id, s.respuestas) = 'paid' THEN 'si' ELSE 'no' END AS universo_paid,
  d.owner_user_id AS dueno, u.nombre AS dueno_nombre,
  d.cohort_id AS cohorte_id, co.codigo AS cohorte, d.etapa::text AS etapa,
  c.resultado::text AS resultado,
  CASE WHEN c.resultado::text IN ('show', 'compromiso_pago', 'cerrada', 'perdida') THEN 'si' ELSE 'no' END AS ocurrio,
  l.email_normalizado AS correo, l.nombre AS nombre
FROM public.calls c
JOIN public.programs p ON p.id = c.program_id
LEFT JOIN public.deals d ON d.id = c.deal_id
LEFT JOIN public.submissions s ON s.id = d.submission_origen_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.users u ON u.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
CROSS JOIN LATERAL (SELECT (coalesce(c.fecha_agenda, c.fecha_llamada) AT TIME ZONE 'America/Bogota')::date AS dia) f
WHERE c.anulado_en IS NULL AND (d.id IS NULL OR d.anulado_en IS NULL);--> statement-breakpoint
-- La venta se fecha por el dia del PRIMER PAGO (abono vigente mas antiguo, Bogota); sin abono, por el dia de la etapa.
CREATE VIEW crm_definicion.ventas AS
SELECT d.id AS id_del_deal, d.lead_id AS id_del_lead, d.program_id AS programa_id, p.slug AS programa,
  f.dia, date_trunc('week', f.dia::timestamp)::date AS semana, date_trunc('month', f.dia::timestamp)::date AS mes,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE crm_definicion.utm_area(s.utm_source, s.utm_medium, d.program_id, s.utm_id, s.respuestas) END AS area,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_canal(s.utm_source) END AS canal,
  CASE WHEN s.id IS NULL THEN 'sin_envio_origen' ELSE mcp_lectura.utm_cuenta(s.utm_source) END AS cuenta,
  d.owner_user_id AS dueno, u.nombre AS dueno_nombre,
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
JOIN public.programs p ON p.id = d.program_id
LEFT JOIN public.submissions s ON s.id = d.submission_origen_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.users u ON u.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
CROSS JOIN LATERAL (SELECT (v.fecha_venta AT TIME ZONE 'America/Bogota')::date AS dia_de_etapa) e
CROSS JOIN LATERAL (SELECT min(a.fecha) AS primer_pago FROM public.abonos a WHERE a.deal_id = d.id AND a.anulado_en IS NULL AND a.concepto = 'ticket') pp
CROSS JOIN LATERAL (SELECT coalesce(pp.primer_pago, e.dia_de_etapa) AS dia) f;--> statement-breakpoint
CREATE VIEW crm_definicion.abonos AS
SELECT a.id AS id_del_abono, a.deal_id AS id_del_deal, a.program_id AS programa_id, p.slug AS programa,
  a.fecha AS dia, date_trunc('week', a.fecha::timestamp)::date AS semana, date_trunc('month', a.fecha::timestamp)::date AS mes,
  a.moneda, a.monto, a.concepto::text AS concepto, a.plataforma_id AS plataforma,
  a.registrado_por_user_id AS registrado_por, ur.nombre AS registrado_por_nombre,
  d.owner_user_id AS dueno, uo.nombre AS dueno_nombre,
  d.cohort_id AS cohorte_id, co.codigo AS cohorte, d.etapa::text AS etapa_del_deal,
  (d.anulado_en IS NULL) AS deal_vigente, l.email_normalizado AS correo, l.nombre AS nombre
FROM public.abonos a
JOIN public.deals d ON d.id = a.deal_id
JOIN public.programs p ON p.id = a.program_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.users ur ON ur.id = a.registrado_por_user_id
LEFT JOIN public.users uo ON uo.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
WHERE a.anulado_en IS NULL;--> statement-breakpoint
CREATE VIEW crm_definicion.gasto AS
SELECT g.id AS id_del_gasto, g.program_id AS programa_id, p.slug AS programa,
  g.fecha AS dia, date_trunc('week', g.fecha::timestamp)::date AS semana, date_trunc('month', g.fecha::timestamp)::date AS mes,
  g.moneda, g.monto, g.pauta_objeto_id AS objeto_de_pauta, po.cuenta_id AS cuenta_meta,
  po.id_meta, po.nombre AS objeto_nombre, po.nivel::text AS nivel,
  g.impresiones, g.alcance, g.clics_enlace, g.vistas_landing, g.registros_meta, g.agendas_meta
FROM public.gasto_pauta g
JOIN public.programs p ON p.id = g.program_id
LEFT JOIN public.pauta_objetos po ON po.id = g.pauta_objeto_id
WHERE g.area = 'paid' OR g.pauta_objeto_id IS NOT NULL;--> statement-breakpoint
CREATE VIEW crm_definicion.leads AS
SELECT l.id AS id_del_lead, l.program_id AS programa_id, p.slug AS programa,
  l.email_normalizado AS correo, l.nombre, l.telefono, l.entrada::text AS entrada,
  (l.entrada::text = 'formulario') AS cuenta_como_lead,
  (l.fecha_primera_aplicacion AT TIME ZONE 'America/Bogota')::date AS dia_primera_aplicacion,
  (CASE WHEN l.entrada::text = 'formulario' THEN l.fecha_primera_aplicacion ELSE l.created_at END AT TIME ZONE 'America/Bogota')::date AS dia_de_entrada,
  l.num_aplicaciones, l.calificacion, l.puntaje, l.lead_quality, l.lead_value,
  l.traido_por_user_id AS traido_por
FROM public.leads l
JOIN public.programs p ON p.id = l.program_id;--> statement-breakpoint
CREATE VIEW crm_definicion.deals AS
SELECT d.id AS id_del_deal, d.lead_id AS id_del_lead, d.program_id AS programa_id, p.slug AS programa,
  d.etapa::text AS etapa, d.pendiente::text AS pendiente,
  (d.etapa::text IN ('ganado_parcial', 'ganado_completo')) AS etapa_vendida, d.cortesia,
  (coalesce(s.fecha_envio, s.created_at, d.created_at) AT TIME ZONE 'America/Bogota')::date AS dia_de_creacion,
  d.owner_user_id AS dueno, u.nombre AS dueno_nombre,
  d.cohort_id AS cohorte_id, co.codigo AS cohorte, d.valor_vendido_usd, d.fecha_limite_pago,
  l.email_normalizado AS correo, l.nombre AS nombre, l.telefono
FROM public.deals d
JOIN public.programs p ON p.id = d.program_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.submissions s ON s.id = d.submission_origen_id
LEFT JOIN public.users u ON u.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
WHERE d.anulado_en IS NULL;--> statement-breakpoint
-- ─────────────────────────────────────────────── las vistas del MCP: la definicion + alcance + enmascarado. Mismas columnas
-- y mismo orden que la 0152 (el contrato del MCP no cambia); se recrean porque Postgres no deja reordenar ni cambiar tipos.
DROP VIEW mcp_lectura.envios, mcp_lectura.agendas, mcp_lectura.citas, mcp_lectura.ventas, mcp_lectura.abonos,
  mcp_lectura.gasto, mcp_lectura.leads, mcp_lectura.deals;--> statement-breakpoint
CREATE VIEW mcp_lectura.envios WITH (security_barrier = true) AS
SELECT d.id_del_envio, d.programa_id, d.programa, d.dia, d.semana, d.mes, d.area, d.canal, d.cuenta, d.tipo, d.campana, d.fuente_id,
  d.utm_source, d.utm_medium, d.utm_content, d.utm_term, d.categoria, d.id_del_lead, d.correo, d.nombre, d.es_primer_envio_del_correo
FROM crm_definicion.envios d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.programa_id;--> statement-breakpoint
CREATE VIEW mcp_lectura.agendas WITH (security_barrier = true) AS
SELECT d.id_de_la_llamada, d.id_del_deal, d.programa_id, d.programa, d.dia, d.semana, d.mes, d.hora, d.hora_minuto,
  d.area, d.canal, d.cuenta, d.utm_source, d.utm_medium, d.categoria, d.tiene_envio, d.universo_paid,
  CASE WHEN al.ve_equipo THEN d.dueno END AS dueno,
  CASE WHEN al.ve_equipo THEN d.dueno_nombre END AS dueno_nombre,
  d.cohorte_id, d.cohorte, d.etapa, d.resultado, d.correo, d.nombre
FROM crm_definicion.agendas d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.programa_id;--> statement-breakpoint
CREATE VIEW mcp_lectura.citas WITH (security_barrier = true) AS
SELECT d.id_de_la_llamada, d.id_del_deal, d.programa_id, d.programa, d.dia, d.semana, d.mes, d.area, d.canal, d.cuenta, d.universo_paid,
  CASE WHEN al.ve_equipo THEN d.dueno END AS dueno,
  CASE WHEN al.ve_equipo THEN d.dueno_nombre END AS dueno_nombre,
  d.cohorte_id, d.cohorte, d.etapa, d.resultado, d.ocurrio, d.correo, d.nombre
FROM crm_definicion.citas d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.programa_id;--> statement-breakpoint
CREATE VIEW mcp_lectura.ventas WITH (security_barrier = true) AS
SELECT d.id_del_deal, d.id_del_lead, d.programa_id, d.programa, d.dia, d.semana, d.mes, d.area, d.canal, d.cuenta,
  CASE WHEN al.ve_equipo THEN d.dueno END AS dueno,
  CASE WHEN al.ve_equipo THEN d.dueno_nombre END AS dueno_nombre,
  d.cohorte_id, d.cohorte, d.etapa, d.valor_vendido_usd, d.dia_de_venta, d.dia_de_etapa, d.correo, d.nombre
FROM crm_definicion.ventas d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.programa_id;--> statement-breakpoint
CREATE VIEW mcp_lectura.abonos WITH (security_barrier = true) AS
SELECT d.id_del_abono, d.id_del_deal, d.programa_id, d.programa, d.dia, d.semana, d.mes, d.moneda, d.monto, d.concepto, d.plataforma,
  CASE WHEN al.ve_equipo THEN d.registrado_por END AS registrado_por,
  CASE WHEN al.ve_equipo THEN d.registrado_por_nombre END AS registrado_por_nombre,
  CASE WHEN al.ve_equipo THEN d.dueno END AS dueno,
  CASE WHEN al.ve_equipo THEN d.dueno_nombre END AS dueno_nombre,
  d.cohorte_id, d.cohorte, d.etapa_del_deal, d.deal_vigente, d.correo, d.nombre
FROM crm_definicion.abonos d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.programa_id;--> statement-breakpoint
CREATE VIEW mcp_lectura.gasto WITH (security_barrier = true) AS
SELECT d.id_del_gasto, d.programa_id, d.programa, d.dia, d.semana, d.mes, d.moneda, d.monto, d.objeto_de_pauta, d.cuenta_meta,
  d.id_meta, d.objeto_nombre, d.nivel, d.impresiones, d.alcance, d.clics_enlace, d.vistas_landing, d.registros_meta, d.agendas_meta
FROM crm_definicion.gasto d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.programa_id;--> statement-breakpoint
CREATE VIEW mcp_lectura.leads WITH (security_barrier = true) AS
SELECT d.id_del_lead, d.programa_id, d.programa, d.correo, d.nombre, d.telefono, d.entrada, d.cuenta_como_lead,
  d.dia_primera_aplicacion, d.dia_de_entrada, d.num_aplicaciones, d.calificacion, d.puntaje, d.lead_quality, d.lead_value,
  CASE WHEN al.ve_equipo THEN d.traido_por END AS traido_por
FROM crm_definicion.leads d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.programa_id;--> statement-breakpoint
CREATE VIEW mcp_lectura.deals WITH (security_barrier = true) AS
SELECT d.id_del_deal, d.id_del_lead, d.programa_id, d.programa, d.etapa, d.pendiente, d.etapa_vendida, d.cortesia, d.dia_de_creacion,
  CASE WHEN al.ve_equipo THEN d.dueno END AS dueno,
  CASE WHEN al.ve_equipo THEN d.dueno_nombre END AS dueno_nombre,
  d.cohorte_id, d.cohorte, d.valor_vendido_usd, d.fecha_limite_pago, d.correo, d.nombre, d.telefono
FROM crm_definicion.deals d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.programa_id;--> statement-breakpoint
GRANT SELECT ON mcp_lectura.envios, mcp_lectura.agendas, mcp_lectura.citas, mcp_lectura.ventas, mcp_lectura.abonos,
  mcp_lectura.gasto, mcp_lectura.leads, mcp_lectura.deals TO mcp_lectura_login;
