---
id: 131
etapa: E6
serves: "ADR 0064 (enmienda el 0039 punto 2)"
depends: []
status: done
---

# 131 — Varios formularios activos por programa

## Objetivo

Que un programa reciba leads por más de un formulario a la vez, para pasar de Typeform a Dapta (130) sin
un día en que uno de los dos deje de entrar al CRM.

## Por qué ahora

Mani, 30-sep: *"cada programa puede tener 1 o más links de forms, porque cuando se hace una migración va a
haber un punto en el que ambos siguen activos"*. ComunicArte ya tiene su formulario de Dapta creado. Hoy
`activarFuente` le respondería 409 a la segunda fuente activa (`sources_una_activa_por_programa_idx`), y el
webhook de una fuente inactiva responde 404.

## Alcance

- **Dentro:** migración que quita `sources_una_activa_por_programa_idx` (la genera y aplica la sesión
  principal; `SET lock_timeout = '5s'` al inicio, porque `sources` se lee en cada webhook).
- **Dentro:** `activarFuente` (`lib/catalogo/fuentes.ts`) deja de traducir ese choque a 409. Sigue probando
  el mapeo contra los encabezados reales antes de activar (ticket 016).
- **Dentro:** `tests/fuentes.test.ts`: el caso que hoy espera 409 pasa a esperar dos fuentes activas del
  mismo programa, y los envíos de las dos caen en el mismo lead cuando el correo es el mismo.
- **Dentro:** la pantalla de fuentes muestra cuántas activas tiene cada programa y la salud de cada una (107)
  para saber cuándo apagar la vieja.
- **Dentro:** actualizar la fila "Cuántos intakes de leads tiene un programa" de `AGENTS.md` §Contratos y el
  ADR 0039.
- **Fuera:** el adaptador de Dapta (130).

## Decisión abierta (de Mani)

**¿Qué link reparte el CRM?** El generador de links de captación (ADR 0051, ticket 092) usa
`programs.form_url`, que es uno solo. Con dos formularios activos:

- **Recomendado:** el link público vive en la fuente (`sources.form_url`), y una fuente por programa es la
  **principal** (`sources.principal`, índice único parcial `WHERE principal`, ADR 0005). El generador y la
  ficha del programa usan la principal. Cambiar de proveedor es mover la marca y no editar el programa.
  `programs.form_url` se retira, y el CHECK `programs_activo_con_formulario_y_token` (ADR 0057) pasa a
  exigir "tiene una fuente principal".
- **Mínimo:** dejar `programs.form_url` y cambiarlo a mano el día del corte. Es menos trabajo, pero el link
  queda en el programa y su formulario en la fuente: son dos lugares que pueden no coincidir.

## Cerrado (30-sep)

- Migración 0050 (quita el índice) aplicada en producción; `activarFuente` ya no da 409; la pantalla cuenta las
  fuentes activas de cada programa. Probado en `tests/fuentes.test.ts` y `tests/webhook-matriz.test.ts` (Typeform y
  Dapta activos en el mismo programa, la misma persona por los dos = un lead con dos envíos).
- **La decisión del link quedó abierta como A11** (`docs/plan.md` §7). Mani (30-sep): varios formularios activos por
  programa son una realidad permanente, no solo de migración. Mientras se decide, el generador sigue usando
  `programs.form_url`.

## Done cuando

- Dos fuentes webhook activas del mismo programa reciben envíos firmados y los dos entran al mismo programa
  (test sobre PGlite, por la ruta real).
- La pantalla de fuentes deja activar la segunda y muestra las dos con su salud.
- Si se toma la opción recomendada: el generador sale de la fuente principal, y el índice rechaza dos
  principales en el mismo programa.
- `npm test`, `npm run typecheck`, `npm run lint` y `npm run build` limpios.
