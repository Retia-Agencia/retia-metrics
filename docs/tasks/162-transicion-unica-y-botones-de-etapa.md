---
id: 162
etapa: O2
serves: "docs/anotaciones.md A-43, A-44; ADR 0075 (enmienda de UI)"
depends: [156]
status: todo
---

# 162 — Una sola tarjeta de Transición, con botones de etapa redondos

## Por qué existe

Mani, recorriendo la ficha del deal (2-oct): la tarjeta Actividades tiene un formulario **siempre abierto** que
ocupa media pantalla, y la tarjeta Transición (156) ya tiene los botones de la pregunta de la etapa. Son dos lugares
para "registrar lo que pasó". Además los botones de Transición son un `Button variant="outline"` que envuelve un
`Badge`: se ve un cuadro gris alrededor de la píldora de color.

## Qué hace cada botón hoy (para no perder nada al fundir)

- **Mover a una etapa:** `respuestasPorDestino(...).destinos` en `components/deals/pregunta-de-etapa.ts`.
- **Contacto / Intento:** son una actividad (`registrarActividad`), pero mueven el deal (Potencial o Registrado →
  En gestión; contacto → Contactado; contacto con Próxima cohorte pendiente la quita). ADR 0071 puntos 1 y 2.
- **Seguimiento / Otra llamada / Próxima cohorte:** misma etapa, otro **pendiente** del deal, por `moverEtapa()`.
- **Nota:** anotación pura, nunca mueve. Hoy solo existe en el formulario de Actividades.

## Alcance

1. **Una sola tarjeta "Transición"** con dos filas:
   - **Mover a:** un botón por etapa destino (lo de hoy).
   - **Registrar:** Contacto, Intento, Nota y los pendientes de la etapa (lo que hoy sale en "Sin cambiar de
     etapa"), más **Nota**, que es nueva en esta tarjeta.
   Todo botón abre un pop-up con los datos que implica (canal y nota para una actividad; los requisitos del motor
   para un movimiento). Ningún campo de texto queda abierto en la ficha.
2. **La tarjeta Actividades pierde el formulario** y queda como la lista (solo lectura) de contactos, intentos y
   notas. El mecanismo `useAccionPedida` que hoy enfoca ese formulario se reemplaza por el pop-up.
3. **Botón de etapa:** redondo (`rounded-full`), relleno con el tono de la etapa, sin borde ni fondo gris, todos
   del **mismo ancho**: el del nombre de etapa más largo de los que se muestran. Un componente
   (`BotonDeEtapa`) que reúsa los tonos de `etapa-tono.ts`; Tinta manda (`docs/structure.md` §9): ningún color a
   mano, los cinco tonos de estado son los de `<Badge variant>`. Varias etapas comparten tono, y está bien.
4. El Kanban sigue abriendo **el mismo** pop-up al soltar una tarjeta (ADR 0075): si el pop-up cambia de
   componente, el Kanban lo usa igual.

## Archivos

Toca: `components/deals/ficha/ficha-transicion.tsx`, `ficha-actividades.tsx`, `accion-pedida.ts`,
`components/deals/responder-pregunta.tsx`, `pregunta-de-etapa.ts` (solo si hace falta agregar Nota), un componente
nuevo de botón. **No toca** `ficha-llamadas.tsx` (lo toca el 163), `dialogo-mover.tsx` ni `lib/`.

Tests que afirman el contrato que cambia: `tests/pregunta-de-etapa.test.ts` (ninguna respuesta sin flecha, ninguna
flecha de persona sin respuesta) y `tests/acciones-ficha-deal.test.ts`.

## Done cuando

- La ficha no tiene ningún campo de texto abierto; registrar un contacto, un intento o una nota sale de un botón
  de Transición y su pop-up, y queda en la lista.
- Los botones de etapa son redondos, del color de su etapa, sin cuadro gris, todos del mismo ancho, y caben a 375 px.
- El Kanban sigue moviendo por el mismo pop-up.
- `npm run build` en verde (componente cliente, AGENTS.md) y recorrido en `dev:local`: clic en cada botón de
  cada etapa, consola abierta, escritorio y 375 px.
