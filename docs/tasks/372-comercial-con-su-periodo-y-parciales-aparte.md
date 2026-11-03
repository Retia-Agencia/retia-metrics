---
id: 372
etapa: hub
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-8, G-9) · ADR 0069 · absorbe la parte de Comercial del 359 (punto 3)"
depends: [368]
status: todo
---

# 372 — Comercial: cada cifra dice su periodo, y los deals de un parcial van aparte

Entrega del Hub a Gerencia, fase 1 (`docs/hub.md` §0).

## Por qué

Daniel Tovar, weekly del 3-nov, en Hub › Comercial:

> "Agendas, agendas, agendas en qué periodo de tiempo?"

> "Deals (...) Pero son envíos completos o parciales? (...) Si yo llené el formulario hasta la mitad, ¿me cuenta como
> un deal?" Mani: "Sí (...) Entonces puede estar mezclado."

Hoy (3-nov): las tarjetas de Comercial (`components/dashboard/operacion.tsx`) siguen el periodo de arriba, pero no lo
dicen en la tarjeta; "Deals creados" cuenta igual un deal nacido de un formulario completo que uno nacido de un parcial
(ADR 0069: un parcial sin agenda abre en Potencial); "% de deals que agendaron" mezcla los dos universos, y un parcial
casi nunca agenda, así que la tasa baja sin que nada haya empeorado.

## Alcance

1. **Cada tarjeta y cada gráfica de Comercial lleva su contexto en el subtítulo**, armado por un solo componente desde
   los filtros del 368: "C3 · 1-oct a hoy · todos los closers". Ninguna cifra sin su periodo.
2. **"Deals creados" se parte en dos, con el total arriba:** "desde un formulario completo" y "desde un parcial". El
   hecho que decide es el envío que abrió el deal (`submissions.es_parcial`). El día del deal es UNO, el del envío que lo
   abrió (`coalesce(fecha_envio, created_at)`, la regla del ROAS): se toma esa parte del 354 aquí, el resto del 354 es
   fase 2. Cada mitad abre su lista.
3. **"% de deals que agendaron" se calcula sobre los completos** y lo dice ("de los que llenaron el formulario
   completo"); el de parciales va al lado, rotulado. Mismo universo arriba y abajo (N2).
4. **Comercial se ordena (la parte del 359, punto 3):** arriba el embudo (Envíos → Deals → Agendas → Shows → Ventas, con
   número y % paso a paso), luego Por closer, luego Agendas por semana (con los interruptores del 370). El resto
   (tiempo en etapa, motivos de pérdida y lo demás) va plegado en "Diagnóstico".
5. **Agendas, shows y no shows con las funciones que ya usa Hoy** (299: % de show por deal, ADR 0079; la agenda como
   cita creada). Ninguna fórmula nueva; unificar todas las copias es el 353, fase 2.

## Done cuando

- [ ] Test: dos deals, uno de un completo y uno de un parcial, dan Deals creados 2 = 1 + 1, y "% que agendaron" usa 1
  de denominador.
- [ ] Test: cada mitad abre una lista que suma su cifra con los filtros puestos.
- [ ] Recorrido en `dev:local`: cada tarjeta de Comercial muestra su contexto y cambia al mover cohorte, periodo y
  closer; escritorio y 375 px; `test:humo` en verde.
- [ ] Regla N8: `docs/metricas.md` (Deals creados desde completo y desde parcial) en el mismo commit.
