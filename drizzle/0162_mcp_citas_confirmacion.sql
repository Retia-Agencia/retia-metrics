SET lock_timeout = '5s';--> statement-breakpoint
-- Mi espacio 2b: la confirmación de la cita llega al MCP (consultar_datos). confirmada_antes_de_la_hora
-- repite el predicado de lib/deals/confirmacion-de-cita.ts; tests/mcp-lectura-vistas.test.ts vigila la paridad.
CREATE OR REPLACE VIEW crm_definicion.citas AS
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
  l.email_normalizado AS correo, l.nombre AS nombre,
  c.confirmacion::text AS confirmacion,
  CASE WHEN c.confirmacion::text = 'confirmada' AND c.confirmacion_en <= coalesce(c.fecha_agenda, c.fecha_llamada) THEN 'si' ELSE 'no' END AS confirmada_antes_de_la_hora
FROM public.calls c
JOIN public.programs p ON p.id = c.program_id
LEFT JOIN public.deals d ON d.id = c.deal_id
LEFT JOIN public.submissions s ON s.id = d.submission_origen_id
LEFT JOIN public.leads l ON l.id = d.lead_id
LEFT JOIN public.users u ON u.id = d.owner_user_id
LEFT JOIN public.cohorts co ON co.id = d.cohort_id
CROSS JOIN LATERAL (SELECT (coalesce(c.fecha_agenda, c.fecha_llamada) AT TIME ZONE 'America/Bogota')::date AS dia) f
WHERE c.anulado_en IS NULL AND (d.id IS NULL OR d.anulado_en IS NULL);--> statement-breakpoint
CREATE OR REPLACE VIEW mcp_lectura.citas WITH (security_barrier = true) AS
SELECT d.id_de_la_llamada, d.id_del_deal, d.programa_id, d.programa, d.dia, d.semana, d.mes, d.area, d.canal, d.cuenta, d.universo_paid,
  CASE WHEN al.ve_equipo THEN d.dueno END AS dueno,
  CASE WHEN al.ve_equipo THEN d.dueno_nombre END AS dueno_nombre,
  d.cohorte_id, d.cohorte, d.etapa, d.resultado, d.ocurrio, d.correo, d.nombre,
  d.confirmacion, d.confirmada_antes_de_la_hora
FROM crm_definicion.citas d
JOIN mcp_lectura.alcance al ON al.txid = txid_current() AND al.programa_id = d.programa_id;
