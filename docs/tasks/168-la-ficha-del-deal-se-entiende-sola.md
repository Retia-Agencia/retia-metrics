---
id: 168
etapa: O3
serves: "docs/anotaciones.md A-52, A-53, A-55, A-56, A-58, A-59; ADR 0077 puntos 1 y 6"
depends: []
status: review
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

## Cierre 2026-10-03 (rama `o3-168-ficha-del-deal`, sin migración)

**Estado: `review`**: código, typecheck, lint, build y recorrido en `dev:local` (closer y gerente, escritorio y
375 px) hechos; pasa a `done` con el checkpoint verde. Los tests con base del ticket los corrió Codex en verde
(214 en 15 archivos); los cambios posteriores de la sesión solo corrieron los tests puros (la máquina estaba sin
aire, 7,8 GB de swap): **los tests con base los valida el CI**.

**Qué se construyó**

- **Qué hace cada botón (A-52).** `queHace` en `components/deals/pregunta-de-etapa.ts`, un solo módulo, texto
  visible debajo de cada botón. La consecuencia se deriva, no se escribe por etapa. Para Contacto e Intento sale
  de `etapaTrasActividad` (`lib/deals/actividad-mueve.ts`, nueva), **la misma función con la que
  `registrarActividad` mueve el deal**: `llevaA` (la regla de columnas del Kanban) prometía "pasa a Contactado"
  desde Calificado en adelante, cosa que el motor no hace.
- **Tres franjas (A-55).** Urgente y Alertas son dos tarjetas que solo se pintan con algo adentro; Transición
  lleva lo que le falta a la etapa actual, cada destino con su nombre (el camino principal con insignia) y los
  botones. Borde del tono e insignia, fondo normal. Sin "Otra ruta". La etapa actual ya no sale como destino.
- **Clasificación** (en `lib/queries/ficha-deal.ts`, un `Record` exhaustivo):

  | Urgente | Alertas |
  |---|---|
  | llamada sin resultado, agotó intentos, abono sin comprobante, link sin cita, compromiso vencido, pago vencido, re-agenda sin fecha | estancado, reenvío del formulario, atendida sin Grain, próximo contacto vencido |

  Re-agenda sin fecha no estaba en ninguna lista del ticket: va en Urgente porque hay que agendar ya.
- **Llamadas (A-53).** Fila entera clicable (hover, cursor, foco), la activa arriba y las demás plegadas en
  "Llamadas anteriores (N)"; "Link de la cita" y "Link de Grain" en la fila y en el detalle. "Pegar Grain" →
  "Link de Grain"; "No se dio" con su línea. Al pegar el Grain de una cita ya pasada, `pegarGrain`
  (`lib/deals/llamadas.ts`) anota `fecha_llamada` = la fecha de la cita, y el pop-up lo dice.
  **Desvío del ticket:** "Completar fecha" NO anota `fecha_llamada`: es `completarAgendada`, que pone la fecha de
  la CITA a una llamada que el sistema creó sin fecha y la deja a nombre de quien la completa. Llamarlo
  "¿Cuándo ocurrió?" habría mentido; se llama **"Poner fecha de la cita"**.
- **Orden de bloques (A-56):** Lead y contactos, Origen, Perfil, Log.
- **Editar (A-58):** Área de origen y Dueño (y el motivo si está perdido). El descuento se edita en
  Facturación con la misma `editarDealAccion`. `fechaSeguimiento` salió de `esquemaEditarDeal` y de la acción:
  solo se pone por la transición.
- **Próximo contacto (A-59).** `lib/deals/proximo-contacto.ts` (puro): `proximoContactoSugerido` (+2 hábiles),
  `esquemaProximoContacto` (rechaza hoy y fechas pasadas) y `proximoContactoVencido`, la única respuesta que usan
  la ficha, el Inbox (motivo nuevo `proximo_contacto_vencido`) y el filtro del Kanban (`lib/queries/kanban.ts`,
  una línea). La reja está en `moverDeal` y `revisarMovimientoAccion`. El mensaje del requisito en
  `lib/deals/requisitos.ts` cambió de texto (sin cambio de lógica).

**Bug encontrado en el recorrido y arreglado (anterior a este ticket).** `DialogoMover` arrancaba SIEMPRE con
`descuentoUsd: 0` y la fecha límite sugerida, y los mandaba en cualquier movimiento aunque la flecha no los
pidiera: mover a Atendido **borró el descuento de USD 50 recién puesto** (747 → 797 en `change_log`) y escribió
una fecha límite que nadie pidió, sin error. Con el descuento ahora en Facturación, el siguiente movimiento lo
habría deshecho. Ahora el diálogo solo arranca con lo que `camposDeDialogo` pide; probado: descuento 50, "Otra
llamada", el valor sigue en 747. **Revisar en producción** si hay deals cuyo descuento se perdió así
(`change_log` de `valorVendidoUsd` escrito en el mismo instante que un cambio de `etapa`).

**Mordido forjando la petición:** con el `min` del input quitado, una fecha pasada en Próximo contacto vuelve con
"El próximo contacto tiene que ser una fecha futura." y la base no se mueve.

**Fuera de alcance, anotado:** el Inbox sigue diciendo "Pegar Grain" en sus filas (no es de este ticket); la
fecha de "Próximo contacto" sigue visible en la cabecera después de que el pendiente cambió (es el dato del
deal, no se borra al mover).
