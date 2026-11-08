-- 0118 (ticket 389, M1, ADR 0121): relleno de leads.fecha_primera_aplicacion donde es nula.
-- Solo UPDATE, solo leads de formulario con fecha nula: la fecha es la mas antigua de
-- coalesce(fecha_envio, created_at) de sus envios (los parciales de Typeform no traen fecha_envio).
-- Cada fila rellena deja su fila en change_log en la MISMA sentencia (origen app, sin usuario: es una migracion).
-- Los leads de alta manual (entrada = 'crm') no se tocan: no tienen envio y el CHECK de la 0119 los excluye.
WITH objetivo AS (
  SELECT l.id, s.fecha
  FROM leads l
  JOIN (
    SELECT lead_id, min(coalesce(fecha_envio, created_at)) AS fecha
    FROM submissions
    WHERE lead_id IS NOT NULL
    GROUP BY lead_id
  ) s ON s.lead_id = l.id
  WHERE l.entrada = 'formulario' AND l.fecha_primera_aplicacion IS NULL
),
rellenados AS (
  UPDATE leads
  SET fecha_primera_aplicacion = objetivo.fecha
  FROM objetivo
  WHERE leads.id = objetivo.id
  RETURNING leads.id, leads.email_normalizado, objetivo.fecha
)
INSERT INTO change_log (tabla, registro_id, etiqueta, campo, valor_anterior, valor_nuevo, origen)
SELECT 'leads', id, 'relleno 0118 (ADR 0121)', 'fecha_primera_aplicacion', NULL,
       to_char(fecha AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'), 'app'
FROM rellenados;
--> statement-breakpoint
-- Guarda: si queda algun lead de formulario sin fecha, la migracion entera se revierte.
DO $$
DECLARE restantes integer;
BEGIN
  SELECT count(*) INTO restantes FROM leads WHERE entrada = 'formulario' AND fecha_primera_aplicacion IS NULL;
  IF restantes > 0 THEN
    RAISE EXCEPTION '0118: quedan % leads de formulario sin fecha_primera_aplicacion', restantes;
  END IF;
END $$;
