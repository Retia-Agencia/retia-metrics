---
id: 184
etapa: O4
serves: "docs/anotaciones.md A-90, A-91, A-92; ADR 0035, 0060; GC-27"
depends: []
status: todo
---

# 184 — Leads: envíos desplegables, y los posibles duplicados se deciden donde se trabaja

Sesión **S4**, ola O4 parte 1. Sin migración.

## Por qué existe

- **A-91.** En la ficha del lead los envíos se ven como un bloque largo. Mani: cada envío es un desplegable estándar
  que abre y cierra; abierto muestra lo que respondió el lead. Todo el recuadro del envío es clicable con hover, y el
  deal asociado también.
- **A-90.** ¿Quién decide un posible duplicado? Hoy: quien trabaja el programa (closer con membresía activa) o quien
  administra, **solo desde la tab Leads** (`components/leads/posibles-duplicados.tsx`, `lib/ingesta/separar.ts`, ADR
  0035 y 0060). Mani quiere que el closer lo vea como alerta en Mi espacio (lo hace el 183) y en el deal, y lo decida
  ahí: **el mismo lead y el mismo deal**, o **dos leads con dos deals**.
- **A-92 (audit de la sesión central, 3-oct).** 🩸 `separarCorreo` crea el lead nuevo y le mueve sus envíos, pero
  **no le abre deal**: el lead separado queda sin deal, contra GC-27 ("ningún envío se queda sin deal", ADR 0069).
  No lanza ningún error.

Ojo, dos cosas distintas que la pantalla no debe mezclar: **"N envíos"** (151) son reenvíos del mismo correo,
absorbidos en el mismo lead, y no piden decisión. **"Posible duplicado"** es un correo nuevo que entró por un
teléfono conocido (ADR 0035): esa sí pide decisión.

## Alcance

1. **Envíos desplegables (A-91)** en `components/leads/ficha-lead.tsx`: un componente de desplegable por envío
   (cerrado: fecha, fuente, completo o parcial, canal; abierto: las respuestas). Todo el recuadro abre y cierra, con
   hover y teclado (Enter/Espacio, `aria-expanded`). El deal asociado, tarjeta entera clicable con el mismo hover que
   la tarjeta del Kanban (181). El patrón "tarjeta clicable" y "desplegable" queda en `structure.md` §9.
2. **Separar abre el deal del lead nuevo (A-92).** Dentro de la misma transacción de `separarCorreo`, el lead nuevo
   recibe su deal por la regla de siempre (`etapaDeEntrada` con los hechos de su envío más reciente, `abrirDeal`), con
   rastro. Si el envío movido ya había abierto un deal vigente, sigue el 409 de hoy, con un mensaje que enlaza a ese
   deal.
3. **Decidir en el deal (A-90).** Si el lead del deal tiene un correo sin confirmar, la ficha del deal muestra una
   alerta amarilla "Posible duplicado" con los dos datos lado a lado (el correo nuevo, el teléfono en común, el envío
   que lo trajo) y dos botones: **"Es la misma persona"** (`confirmarCorreo`) y **"Son dos personas"**
   (`separarCorreo`, que ahora abre el segundo deal). Mismo permiso de hoy (`exigirAccesoAlPrograma`); una
   **línea de ayuda** dice qué pasa con cada una. La tab Leads sigue igual.
4. **Contrato con el 183:** la consulta de duplicados de `lib/queries/leads.ts` no cambia de firma (Mi espacio la
   importa). Si hace falta un dato más, se agrega un campo opcional.

## Archivos (suyos en la ola)

`components/leads/ficha-lead.tsx`, `components/leads/posibles-duplicados.tsx`, `app/(app)/p/[programa]/leads/*`
(acciones y la ficha), `lib/ingesta/separar.ts`, `lib/queries/ficha-deal.ts`, `components/deals/ficha/ficha-alertas.tsx`,
y las acciones de la ficha del deal que llamen a confirmar/separar. **No toca** `ficha-transicion.tsx` (182) ni
`lib/queries/leads.ts` salvo un campo opcional.

Tests: `tests/separar*.test.ts` (separar abre el deal del lead nuevo en la etapa que toca; el 409 sigue cuando el envío
movido abrió un deal; rastro en `change_log`), permiso forjado desde un closer sin membresía (404/403, la base no se
mueve).

## Done cuando

- Cada envío es un desplegable clicable entero, con hover y teclado; el deal asociado es una tarjeta clicable.
- Separar deja al lead nuevo con su deal (test); ningún lead queda sin deal por separar.
- La ficha del deal ofrece confirmar o separar un posible duplicado, con la explicación de cada botón.
- `npm run build` en verde; recorrido en `dev:local` (sembrar un posible duplicado) como closer y gerente, consola
  abierta, escritorio y 375 px.
