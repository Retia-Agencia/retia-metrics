---
id: 244
etapa: hub
serves: "ADR 0088 puntos 3 a 5 · docs/hub.md H-5, §5.2 (TRM del día) · cierra A12"
depends: []
status: todo
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

- [ ] Correr la lectura dos veces no duplica filas, con test.
- [ ] Un sábado devuelve la tasa vigente, con test.
- [ ] Una fecha sin tasa guardada se dice como tal (la cifra convertida no sale), nunca se usa una tasa inventada.
- [ ] El relleno cuadra con la tasa publicada en tres fechas elegidas a mano (nota de cierre).

## Notas

Los tests no llaman a la fuente: usan respuestas grabadas. La regla dura de fechas aplica: la fecha es de Bogotá.
