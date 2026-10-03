---
id: 162
etapa: O2
serves: "docs/anotaciones.md A-43, A-44; ADR 0075 (enmienda de UI)"
depends: [156]
status: done
---

> **2-oct (noche):** reclamado por la sesión S1 de la ola O2. Codex implementó en `.claude/worktrees/162`. En `main`; cuenta como hecho con el checkpoint verde que lo incluya.

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

## Cierre (2-oct, noche, sesión S1)

**Qué quedó:**

- `components/deals/boton-de-etapa.tsx` (nuevo): píldora `rounded-full` con las clases de `badgeVariants` del tono de
  la etapa (ningún color a mano). El ancho sale del largo en `ch` de la etiqueta más larga de la fila, así todos
  miden lo mismo.
- `ficha-transicion.tsx`: dos filas, **Mover a** (`BotonDeEtapa`) y **Registrar** (Contacto, Intento y Nota fijos,
  más las respuestas de la misma etapa que no son actividad). La tarjeta sale siempre que se puede trabajar el deal
  y no está anulado, también en Ganado completo (ahí solo Registrar).
- `responder-pregunta.tsx`: `useResponder` tiene el pop-up de actividad (canal y "¿Qué pasó?", obligatorio) y
  expone `registrar(deal, tipo)`. Una respuesta de tipo actividad ya no navega a `?accion=contacto`: abre ese pop-up,
  así que **el Kanban, al soltar en En gestión o Contactado, abre el mismo pop-up** sin salir del tablero. Si la
  actividad mueve el deal (ADR 0071 puntos 1 y 2), el pop-up lo dice en una línea.
- `accion-pedida.ts`: sin `contacto` ni `intento` (las llamadas y el abono siguen por `?accion=`).
- `ficha-actividades.tsx`: solo la lista. `page.tsx`: una línea (se fue la prop `dealId`).

**Decisiones de la sesión (no estaban escritas en el ticket):**

1. **Nota no es una `Respuesta`** de `PREGUNTA_DE_ETAPA`: es un botón fijo. Como respuesta, rompería el contrato de
   `tests/pregunta-de-etapa.test.ts` (toda respuesta es una flecha del motor). `pregunta-de-etapa.ts` no se tocó.
2. **Contacto, Intento y Nota salen en las once etapas**, porque el formulario que reemplazan existía en todas. En
   Potencial, Registrado y En gestión, "Contactado" (Mover a) y "Contacto" (Registrar) abren el mismo pop-up; las
   respuestas de actividad se filtran de Registrar para no duplicar ("No, fue un intento" en En gestión).

**Verificación:** typecheck y lint en verde; `npm run build` en verde (desde el worktree, con copia APFS de
`node_modules`). Tests: no corridos en local (swap en 8,6 GB, regla de AGENTS.md); ningún archivo que cubren
`tests/pregunta-de-etapa.test.ts` ni `tests/acciones-ficha-deal.test.ts` cambió (`lib/` y `pregunta-de-etapa.ts`
intactos). Los decide el checkpoint.
Recorrido en `dev:local` (`app162.localhost:3162`, developer): **clic en cada botón de cada una de las once
etapas**, todos abren su pop-up (actividad, `DialogoMover`, agenda, abono o llamada); un contacto y una nota
registrados de verdad en la base local quedan en la lista y el contacto movió el deal de Potencial a Contactado; a
375 px los botones de etapa miden 248 px dentro de una tarjeta de 343, sin scroll horizontal; el Kanban, al soltar
una tarjeta de Potencial en Contactado, abre "Registrar contacto". Consola sin errores de la app.
