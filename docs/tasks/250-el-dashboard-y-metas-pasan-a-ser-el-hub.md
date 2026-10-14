---
id: 250
etapa: hub
serves: "ADR 0086 puntos 1, 2 y 5 · docs/hub.md H-1, H-12"
depends: []
status: en curso
quien: Alejandro (14-oct)
---

# 250 — El Dashboard y Metas pasan a ser el Hub

## Objetivo

Que la tab Dashboard se llame Hub, tenga sus cinco pestañas en el orden del ADR 0086 y absorba la página Metas, sin
cambiar ninguna cifra.

## Alcance

- **Dentro:** rutas `/p/[programa]/hub` y `/hub` (todos los programas); `/p/[programa]/dashboard`, `/dashboard`,
  `/p/[programa]/metas` y sus `lista` redirigen conservando la query (como `/mi-dia`, hasta una fecha que se anota en
  `operations.md`).
- **Dentro:** el menú (`lib/nav.ts`), el aterrizaje del gerente y el developer, el selector de programa (204) y "Volver"
  (174) apuntan al Hub. La capacidad sigue siendo `veTableroDelPrograma` (ADR 0082); nada de `rol === "..."`.
- **Dentro:** las pestañas **Hoy · Comercial · Dinero · Pauta · Origen** con `?seccion=`. En este ticket solo se
  mudan las piezas que ya existen: lo de Pulso y Metas va a Hoy tal como está; Operación pasa a llamarse Comercial;
  Pauta interina queda en Pauta hasta que el 248 la reparta. Hoy se rearma en el 252.
- **Dentro:** el vocabulario: "Hub" en `overview.md` §11 ya está; se cambian los textos de la interfaz y del manual
  (`/manual`) que dicen Dashboard o Metas.
- **Fuera:** cifras nuevas, el selector nuevo (251), la pestaña Hoy rearmada (252), Origen (248).

## Done cuando

- [ ] Toda URL vieja guardada (con filtros) abre la misma vista en el Hub.
- [ ] Un closer que forja `/p/<programa>/hub` recibe lo mismo que hoy con el Dashboard (ADR 0082), con test.
- [ ] Las cifras de cada pestaña son las mismas antes y después, en un programa y en todos (recorrido comparando).
- [ ] `npm run test:humo` pasa con los tres roles (ADR 0083); `npm run build` antes de empujar.
