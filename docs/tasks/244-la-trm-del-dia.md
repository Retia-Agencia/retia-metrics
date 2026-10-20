---
id: 244
etapa: hub
serves: "ADR 0088 puntos 3 a 5 · docs/hub.md H-5, §5.2 (TRM del día) · cierra A12"
depends: []
status: done
---

# 244 — La TRM oficial de cada día, guardada

## Objetivo

Que el CRM tenga la tasa oficial COP/USD de cada fecha, escrita por un solo lugar, para convertir el gasto de
pauta y cruzarlo con las ventas sin convertir nunca en silencio.

## Alcance

- **Dentro:** migración (sesión principal): `tasas_cambio` (fecha única, pesos por dólar, fuente, cuándo se
  leyó). Un día sin publicación usa la tasa vigente ese día, y la consulta lo resuelve, no se inventa una fila.
- **Dentro:** **un solo escritor**, `registrarTasa`, idempotente por fecha. La fuente es la TRM oficial publicada
  en datos.gov.co (Superintendencia Financiera); el ticket confirma el endpoint y su formato antes de escribir
  código, con una llamada real.
- **Dentro:** la lectura del día al cierre (el mismo cron diario del 120 o uno propio, sin pasar el límite de
  Vercel Hobby, R3) y un relleno hacia atrás desde la primera fecha con gasto.
- **Dentro:** `tasaDelDia(fecha)` y `tasasDelRango(desde, hasta)` en un módulo; las importan 123 y 258. Devuelven
  también la etiqueta a mostrar ("TRM 3.912 (13-oct)" o "TRM 3.880 a 3.950").
- **Fuera:** convertir cifras (lo hace cada consulta con este módulo); otras monedas.

## Done cuando

- [x] Correr la lectura dos veces no duplica filas, con test.
- [x] Un sábado devuelve la tasa vigente, con test.
- [x] Una fecha sin tasa guardada se dice como tal (la cifra convertida no sale), nunca se usa una tasa inventada.
- [ ] El relleno cuadra con la tasa publicada en tres fechas elegidas a mano (nota de cierre).

## Notas

Los tests no llaman a la fuente: usan respuestas grabadas. La regla dura de fechas aplica: la fecha es de Bogotá.

## Nota de cierre (14-oct, parcial)

Codex implementó; la sesión revisó e integró (`c3efa1f` a `02ee0d6`). Migración **0082 aplicada en producción** con
el ok de Mani (sin transacciones largas antes; `tasas_cambio` con RLS, vacía). Decisiones de la sesión:

- Una fila por **publicación** (`vigente_desde` a `vigente_hasta`), no por día: el viernes cubre el fin de semana y el
  festivo, y la consulta lo resuelve por el rango. Fuente `datos.gov.co/resource/32sa-8pi3.json`, confirmada con una
  llamada real (la del 15-oct se publica el 14). Respuesta grabada en `tests/fixtures/trm/`.
- `lib/trm/`: `registrarTasa` (único escritor, upsert por `vigente_desde`), `leerTrm` (desde la última publicación
  menos 7 días; con la tabla vacía, desde el primer gasto: **el relleno es la primera corrida**, sin script),
  `tasaDelDia` y `tasasDelRango` (con `faltantes` y la etiqueta).
- Corre dentro del cron de pauta (11:00 UTC), antes de sincronizar y en su propio try: si falla, la pauta corre igual
  y la respuesta trae `trm.error` (y el log). Sin cron nuevo.

**Primera corrida (14-oct, cron lanzado a mano):** 5 publicaciones, 8 a 15-oct, sin huecos; el relleno empieza en el
primer gasto (8-oct). **Arreglo posterior:** un gasto cargado tarde con fecha anterior a la primera tasa guardada baja el
relleno hasta su fecha (antes quedaba sin tasa para siempre), con test.

**Falta:** cuadrar tres fechas contra la TRM publicada (8-oct 3.238,88 · 10-oct 3.194,44 · 14-oct 3.181,74) y marcar el
último criterio.
