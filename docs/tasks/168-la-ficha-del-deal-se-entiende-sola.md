---
id: 168
etapa: O3
serves: "docs/anotaciones.md A-52, A-53, A-55, A-56, A-58, A-59; ADR 0077 puntos 1 y 6"
depends: []
status: en curso (S1, sesión de Mani, 3-oct)
---

# 168 — La ficha del deal se entiende sola

Sesión **S1** de la ola O3 (`docs/plan-reparto.md` §4). Sin migración.

## Por qué existe

Mani (3-oct): la ficha funciona, pero un closer no técnico no sabe qué hace cada botón, qué es urgente y qué solo le
falta para avanzar. Los colores de las alertas se ven mal y "Otra ruta" con desplegable no se entiende.

## Alcance

1. **Transición, qué hace cada botón (A-52).** Cada botón de "Registrar" (Contacto, Intento, Nota, pendientes como
   Próxima cohorte) y de "Mover a" dice en una línea qué registra y qué cambia (por ejemplo: "Contacto: hablaste con el
   lead. El deal pasa a Contactado."). El texto **sale del motor** (`lib/deals/etapas.ts`, `pregunta-de-etapa.ts`,
   ADR 0071 puntos 1 y 2), en un solo módulo, nunca escrito a mano en el componente. Va como descripción corta visible
   (no solo tooltip: en celular no hay hover).
2. **Llamadas en la ficha (A-53).**
   - Toda la fila de la llamada es clicable y lo parece: hover con fondo, cursor de mano, foco con teclado.
   - **La llamada activa** (la que cuenta: la más reciente vigente, ADR 0071) va arriba y marcada; las anteriores
     (reagendadas, canceladas, tenidas) van debajo, atenuadas y plegadas bajo "Llamadas anteriores (N)".
   - **El link de la cita** (`calls.link_calendly`, ya se guarda) sale en la fila y en el detalle
     (`components/deals/detalle-de-llamada.tsx`, `lib/queries/detalle-llamada.ts`), junto a Grain.
   - Los botones de la llamada se renombran por lo que hacen: "Completar fecha" → **"¿Cuándo ocurrió?"**
     (anota `fecha_llamada`, que no es la cita); "Pegar Grain" → **"Link de Grain"** con la línea "la llamada
     sucedió; el deal pasa a Atendido"; "No se dio" con la línea "no show o cancelada; queda para re-agendar". Si la
     cita ya pasó y no tiene `fecha_llamada`, el pop-up de Grain la prellena con la fecha de la cita, así el closer
     casi nunca necesita "¿Cuándo ocurrió?".
3. **Tres franjas (A-55, ADR 0077 punto 6)** en lugar de la tarjeta Alertas actual:
   - **Urgente** (rojo): lo que se resuelve hoy (llamada pasada sin resultado, agotó intentos, abono sin comprobante,
     link enviado sin cita, compromiso o pago vencido).
   - **Alertas** (amarillo): solo las alertas de verdad que no son urgentes (estancado, reenvío del formulario,
     atendida sin Grain, **próximo contacto vencido**). Si hay que reclasificar alguna de las diez de
     `MENSAJE_URGENTE` (`lib/queries/ficha-deal.ts`), la tabla va en la nota de cierre.
   - **Transición** (verde): lo que hoy es "Para avanzar" y las propiedades en rojo del 143. Cada destino se lista
     con lo que le falta, sin desplegable y sin la palabra "Otra ruta": el camino feliz primero, los demás debajo con
     su nombre de etapa.
   Tonos de Tinta (`docs/structure.md` §9): borde o insignia del tono, fondo de la tarjeta normal. Ningún color a mano.
   Una franja vacía no se pinta.
4. **Orden de los bloques (A-56):** Lead y contactos sube a donde hoy está Origen; después Origen y después Perfil.
5. **Editar deal (A-58):** el **descuento** sale de Editar y se edita en la tarjeta de Facturación (misma mutación,
   `lib/deals/editar-deal.ts`). La **fecha de seguimiento** sale de Editar. Editar queda con Área de origen y Dueño,
   y la descripción en una línea.
6. **Próximo contacto (A-59, ADR 0070 enmendado por el 0077):** en la UI, "Fecha de seguimiento" se llama **Próximo
   contacto** (la columna `deals.fecha_seguimiento` no cambia: sin migración). Se pide solo en la transición que la
   exige (PS1, PS2, PS3 y RETRO, `lib/deals/requisitos.ts`), llega **prellenada a +2 días hábiles**
   (`lib/dias-habiles.ts`, Bogotá) y solo acepta fechas futuras (validación en el servidor, no solo en el input).
   Vencida, es una alerta amarilla de la ficha y del Inbox ("Próximo contacto vencido"); el filtro del Kanban
   "seguimiento vencido" usa la misma respuesta, no una segunda.

## Archivos

Suyos en la ola: `components/deals/ficha/*`, `components/deals/detalle-de-llamada.tsx`, `dialogo-mover.tsx`,
`responder-pregunta.tsx`, `pregunta-de-etapa.ts`, `lib/queries/ficha-deal.ts`, `lib/queries/detalle-llamada.ts`,
`lib/deals/editar-deal.ts`, y en `lib/queries/inbox.ts` solo el motivo nuevo de próximo contacto vencido.
**No toca** `components/deals/llamadas-programa.tsx` ni las páginas de Calls (170), `lib/calendly/` (169), la tab
Programa (171). Si necesita `lib/deals/requisitos.ts` para validar la fecha futura, es el único cambio de motor y va
en la nota.

Tests: `tests/pregunta-de-etapa.test.ts`, `tests/acciones-ficha-deal.test.ts`, `tests/llamadas-del-deal.test.ts`,
los de alertas (128, 161) y uno nuevo de Próximo contacto (prellenado, fecha pasada rechazada, vencido = alerta).

## Done cuando

- Cada botón de Transición dice qué hace, y el texto sale de un solo módulo.
- La llamada activa se distingue de las anteriores; el link de la cita y el de Grain salen en la fila y en el detalle.
- La ficha muestra Urgente, Alertas y Transición con los tonos de Tinta, sin "Otra ruta".
- Editar solo tiene Área de origen y Dueño; el descuento se edita en Facturación.
- Próximo contacto llega prellenado, rechaza una fecha pasada forjando la acción y su vencimiento sale en amarillo.
- `npm run build` en verde y recorrido en `dev:local`: clic en todo lo que se abre, consola abierta, escritorio y 375 px.
