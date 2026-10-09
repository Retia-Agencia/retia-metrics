---
id: 222
etapa: O8
serves: "A-126, A-130"
depends: [221]
status: review
---

# 222 — Notificaciones: lo que te toca, por tipo, con las tarjetas de tus deals

## Por qué existe

"Necesita atención" es un scroll infinito. Mani quiere enterarse del estado de su operación de un vistazo, filtrar
por tipo y llegar al deal en un clic: *"literalmente las tarjetas que salen en Deals"*, sin Kanban.

## Alcance

- Pestaña **Notificaciones** de Mi espacio, pantalla completa (la pantalla fija del 185), del programa elegido y
  de los deals del closer (dueño = la sesión, ADR 0076).
- **Chips con su conteo**, uno activo a la vez: **Hoy** (por defecto: llamadas de hoy, seguimientos y reagendas
  con fecha de hoy) · **Re-agenda** · **Seguimiento** · **Próxima Cohorte** · **Vencidos** (los avisos de la
  tarjeta: seguimiento vencido, compromiso vencido, cartera vencida, sin Grain) · **Calendly** (las novedades del
  201, leídas y no leídas) · **Nuevos** (deals que el dueño no ha abierto) · **Duplicados** (los de hoy).
- Arriba de las tarjetas, una línea por chip con lo esencial: "Tienes 4 en Re-agenda. La próxima es hoy a las 3:00
  p. m."
- Las tarjetas son `components/deals/tarjeta-deal.tsx` tal cual, en cuadrícula, ordenadas por la fecha que
  importa en ese chip (próximo contacto, nueva cita, fecha límite) y **paginadas en el servidor** (24 por página).
- **Una sola respuesta por chip**: el predicado de cada uno vive en `lib/mi-espacio/notificaciones.ts` y lo usan
  el conteo, la lista y el circulito (223). Los pendientes salen de `deals.pendiente`, los vencidos de las mismas
  funciones que pintan los avisos de la tarjeta (no se reescriben).
- Tocar una tarjeta abre la ficha; **Volver** regresa al mismo chip y página (`lib/navegacion/volver.ts`). El chip
  va en la URL (`?tab=notificaciones&chip=reagenda`), sin datos personales.

## Done cuando

- [ ] Cada chip muestra solo sus deals y su conteo coincide con la lista completa (test, como el de
      `metricas-con-filas`).
- [ ] Un deal de otro programa o de otro dueño nunca aparece (test forjado).
- [ ] Volver desde la ficha regresa al chip y la página.
- [ ] Recorrido: cada chip, claro y oscuro, 390 px, consola limpia.
