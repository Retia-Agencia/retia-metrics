---
id: 250
etapa: hub
serves: "ADR 0086 puntos 1, 2 y 5 · docs/hub.md H-1, H-12"
depends: []
status: done
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

- [x] Toda URL vieja guardada (con filtros) abre la misma vista en el Hub.
- [x] Un closer que forja `/p/<programa>/hub` recibe lo mismo que hoy con el Dashboard (ADR 0082), con test.
- [x] Las cifras de cada pestaña son las mismas antes y después, en un programa y en todos (recorrido comparando).
- [x] `npm run test:humo` pasa con los tres roles (ADR 0083); `npm run build` antes de empujar.

## Hecho (14-oct, Alejandro)

- **Rutas:** `app/(app)/p/[programa]/hub` y `app/(app)/hub` (con sus `lista`), movidas con `git mv`. Las viejas
  (`dashboard`, `metas` y sus `lista`) son páginas que solo redirigen con la MISMA guarda que tenían (como `/mi-dia`):
  conservan la query y traducen la pestaña (`pulso` → `hoy`, `operacion` → `comercial`) con `queryHaciaElHub` de
  `lib/nav.ts`; Metas abre `?seccion=hoy#metas` en el mismo mes. Se borran el 14-nov (`operations.md` §10).
- **Pestañas:** `SECCIONES_DEL_HUB` en `lib/nav.ts`. Hoy = el Pulso de antes + las metas del mes (con sus flechas de
  mes, `?mes=`). Al paid trafficker, que antes abría Metas por URL, las metas le salen como texto, sin lista
  (`MetasDelMes` con `conListas`). Origen avisa que se está construyendo y manda a Pauta (`origen-pendiente.tsx`).
- **Menú, aterrizaje, selector y Volver:** una sola entrada "Hub" (sin Metas); `TAB_POR_DEFECTO` y `rutaInicial`
  van al Hub; `RUTA_HUB_TODOS`; las etiquetas de Volver dicen Hub. Los nombres internos (`armarVistaDelDashboard`,
  `DashboardPrograma`, `components/dashboard/*`) no se renombraron: ninguna consulta cambia.
- **Medido:** cifras (`main .cifra`) de Hoy, Comercial, Dinero y Pauta, por programa y en todos, con el developer y el
  paid trafficker en la base local: las 12 vistas iguales, en el mismo orden, contra `main`. Humo (escritorio) 3/3
  con developer, closer y paid trafficker; **la base local no tiene gerente** (se sembró antes), el developer en
  vista todo lo cubre. Typecheck, lint, build y los tests del cambio en verde (`paginas`, `roles`, `metas-pagina`,
  `volver` y vecinos). Falta el checkpoint.
- **Queda para quien coordina:** `docs/manuales/mapa-crm.html` todavía dice Dashboard y Metas (se regenera, no se
  edita suelto).
