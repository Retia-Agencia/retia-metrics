# 0005 — Las garantías viven en la base: índices únicos y parciales, no solo código

**Fecha:** 2026-08-19 · **Reescrito:** 2026-09-27 (consolida el molde del candado del ADR retirado
0031) · **Estado:** aceptado

## El problema

Los formularios tienen duplicados masivos: Tactical Investor tenía ~2.950 filas que eran ~1.840
personas (38%), y un correo con 12 aplicaciones. Toda tasa se calcula sobre personas; calcularla
sobre filas infla los números cerca de un 60% y toda decisión de presupuesto sale mal.

Un bug, un script mal corrido o una importación manual meten duplicados **en silencio**: el síntoma
no es un error sino un número que se ve creíble.

## Decidimos

**Toda regla que nunca se puede romper vive en la base**, como índice único (a veces parcial) o
`CHECK`, además del código. Así el intento falla ruidosamente al escribir en vez de corromper el
cálculo durante semanas, venga del camino que venga (la app, un script, el CLI de emergencia).

| Regla | Dónde la garantiza la base |
|---|---|
| Un lead por persona y programa | `leads_programa_email_idx` sobre `(program_id, email_normalizado)` |
| Un correo o teléfono pertenece a un solo lead del programa | `lead_contactos_valor_idx` sobre `(program_id, tipo, valor)` |
| Un envío no se duplica en un reintento | `submissions_fuente_token_idx` sobre `(source_id, token, es_parcial)` (migración 0022) |
| Un deal abierto por lead y programa | `deals_uno_abierto_por_lead_y_programa_idx`, parcial `WHERE etapa NOT IN (completo, cierre_perdido) AND anulado_en IS NULL` |
| Una cohorte activa por programa | `cohorts_una_activa_por_programa_idx`, más el `CHECK` de la ventana de venta (ADR 0022) |
| Una fuente activa por programa | `sources_una_activa_por_programa_idx`, parcial `WHERE activo` (ADR 0039) |
| Dos cuentas no reclaman el mismo closer | `users_closer_id_normalizado_idx` (ADR 0030) |
| Una plataforma no se parte en dos por mayúsculas | `plataformas_pago_nombre_idx` sobre `lower(nombre)` (ADR 0034) |

El dedup de código sigue existiendo (`lib/ingesta/identidad.ts`): conserva la fecha de aplicación
más antigua, no deja que un envío posterior con campos vacíos borre lo que ya se sabía, y cuenta las
aplicaciones como señal de intensidad. La base es la red por debajo.

## El molde para la exclusión mutua

Cuando dos procesos no pueden correr a la vez sobre lo mismo, **el INSERT de la fila que marca "estoy
corriendo" ES el candado**, contra un índice único parcial (`WHERE estado = 'corriendo'`). Chocar da
`23505`, que se traduce a un 409: no es un fallo, es el candado funcionando. Una fila que quedó
"corriendo" más allá del doble del tiempo máximo de la función se cierra antes de intentar, o el
candado pasaría de proteger a bloquear para siempre.

No se usa `pg_advisory_lock`: con el pooler de Supabase en modo transaction un lock de sesión no
sobrevive entre consultas (ADR 0047), y un índice no hay que acordarse de soltarlo si la función
muere a la mitad. Hoy lo usa el sync de Sheets (`sync_runs`); es el molde para cualquier otro caso.
