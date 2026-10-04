---
id: 197
etapa: O6
serves: "docs/anotaciones.md A-101; A-06, A-86; ticket 148"
depends: [193, 148]
status: todo
---

# 197 — Dashboard: pantalla fija y cada sección en su pestaña

Sesión **P5**, frente de pantallas de la ola O6. Arranca cuando el 193 esté en `main`. Sin migración.

## Por qué existe

**A-101 (Mani, 4-oct).** El dashboard del programa apila las cuatro secciones del 148 en una página larga. Con
pestañas se ve junta la información relacionada y no satura.

## Alcance

1. **Las pestañas son las secciones que ya existen** (148); no se reagrupan métricas:

   | Pestaña (`id`) | Componente | Línea descriptiva |
   |---|---|---|
   | `pulso` | `components/dashboard/pulso.tsx` | Cómo va el mes: meta, ventas, caja y lo que pide atención. |
   | `operacion` | `operacion.tsx` | El embudo, las llamadas y el trabajo de cada closer. |
   | `dinero` | `dinero.tsx` | Lo contratado, lo cobrado y lo que falta por cobrar. |
   | `pauta` | la sección "Pauta y origen (interina)" de la página | De dónde vienen los leads y cuánto cuesta cada uno. |

   Abre en `pulso`. Los textos los afina Mani al revisar; los anclas `#pulso`, `#operacion`, `#dinero` y `#pauta` pasan
   a `?seccion=`, y quien enlace a ellos se actualiza (`grep`).
2. **Pantalla fija**: el filtro del dashboard (periodo, closer, cohorte) y la barra fijos arriba; el scroll en la
   pestaña. Cambiar de pestaña **conserva el filtro** (la pieza del 193 conserva el query) y cambiar el filtro conserva
   la pestaña (revisar `filtro-dashboard.tsx`: si arma la URL desde cero, se pierde `seccion`). A 375 px vuelve el
   scroll de página.
3. **Cada cifra sigue abriendo su lista** (ADR 0067), y el "Volver" de `/p/[programa]/dashboard/lista` regresa a la
   pestaña de donde salió (el `origen` del 174 lleva `seccion`).
4. **Choque con la ola O6:** D1 (187), D2 (190), D4 (147) y el 188/191 editan **los componentes de sección**; este
   ticket **no los edita**: solo `p/[programa]/dashboard/page.tsx` y `components/dashboard-programa.tsx`, que decide
   qué sección se pinta. Si una sección necesita un cambio para caber, se pide a su dueño. El dashboard de todos los
   programas (`app/(app)/dashboard`, 192) adopta las mismas pestañas en su ticket, no en este.
5. Solo se calcula lo de la pestaña activa **si es barato hacerlo**; si `vistaDelDashboard` calcula todo junto, se
   deja así (a esta escala no importa) y se anota.

## Archivos

`app/(app)/p/[programa]/dashboard/page.tsx`, `components/dashboard-programa.tsx`, `components/filtro-dashboard.tsx`
(solo para conservar `seccion`).

## Done cuando

- Cuatro pestañas con su línea; el filtro y la pestaña se conservan entre sí; la página no crece desde `md`.
- Una cifra abre su lista y "Volver" regresa a la misma pestaña con el mismo filtro.
- `tests/vista-dashboard.test.ts` y `tests/paginas.test.ts` siguen en verde; typecheck, lint, `npm run build`.
- Recorrido en `dev:local` como gerente y closer, escritorio y 375 px, consola abierta, en cada pestaña cambiando el
  periodo y el closer y abriendo una lista.
