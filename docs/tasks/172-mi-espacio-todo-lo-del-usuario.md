---
id: 172
etapa: O3
serves: "docs/anotaciones.md A-46, A-64, A-66 (y A-04, A-05); ADR 0077 punto 1; enmienda ADR 0028; reemplaza el 164"
depends: [170, 171, 169]
status: todo
---

# 172 — Mi espacio: todo lo del usuario en un lugar, y "Ver como" a un closer de verdad

Sesión **S5**, ola O3 parte 2 (después de 169, 170 y 171 en `main`). Reemplaza al 164 (su alcance entra aquí entero).
Sin migración.

## Por qué existe

`/mi-dia` está vacío, `/perfil` muestra poco y aún enseña `closer_id`, y lo del usuario vive en tres pantallas. Y la
vista "como closer" del developer no sirve para revisar: usa las membresías del developer (cero), así que no ve tabs,
deals ni Calendly (A-64, audit del 3-oct). Con membresía, un closer real sí ve sus tabs.

## Alcance

1. **Mi espacio (A-46, A-66)** reemplaza a `/mi-dia` y a `/perfil` en una sola ruta (`/mi-espacio`; las dos viejas
   redirigen). Arriba, **Perfil**: nombre y foto (vienen de Google, no se editan), rol, y por cada programa con
   membresía su **cuenta de Calendly** (el componente del 169). Es todo lo que un closer edita de sí mismo; `closer_id`
   no se muestra (167, 159). Debajo, con selector de programa obligatorio (el programa es frontera), en tabs:
   **Pendientes** (lo mío que necesita atención, `lib/queries/inbox.ts`), **Mis deals** (las tarjetas del Kanban con
   su filtro), **Mis llamadas** (la consulta del 170 con el alcance del closer), **Mis students**. Cada sección
   llama la consulta que ya existe; si una no admite el filtro por dueño, se le agrega el parámetro en su módulo.
2. **Sin programas no hay pantalla vacía (A-04).** Un closer sin membresías ve "Todavía no tienes programas
   asignados; pídele a tu gerente que te agregue al equipo de un programa". Con membresía ve todas las tabs del
   programa (Dashboard, Leads, Deals, Inbox, Calls, Students, Programa), tengan o no datos.
3. **Ver como un closer elegido, en solo lectura (A-64, enmienda ADR 0028).** El menú de vista del developer ofrece
   "Ver como closer → {lista de closers activos}". La cookie guarda el `users.id` elegido (validado contra `users` en
   cada lectura: inexistente o inactivo = vuelve a `todo`). Las **lecturas** se proyectan con ese usuario (sus
   membresías, sus deals, sus llamadas). **Toda escritura se rechaza** mientras la vista suplanta a alguien: la reja
   vive en UN lugar de `lib/auth/` que todas las server actions y route handlers ya pasan (la misma que da el actor),
   con el mensaje "Estás viendo como {nombre}: solo lectura". Una barra fija arriba lo dice y tiene "Salir".
   Solo el developer real puede activarla (la vista solo estrecha, ADR 0028).
4. **Navegación.** `lib/nav.ts`: "Mi espacio" para quien trabaja leads; `rutaInicial` del closer = Mi espacio (con
   Pendientes arriba). El menú de usuario enlaza a Mi espacio en lugar de "Mi perfil". Avisar a Alejo (`lib/nav.ts`).

## Archivos

Suyos: `app/(app)/mi-espacio/` (nuevo), `app/(app)/mi-dia/` y `app/(app)/perfil/` (redirigen), `components/perfil-propio.tsx`,
`components/user-menu.tsx`, `components/app-sidebar.tsx`, `lib/nav.ts`, `lib/auth/vista.ts` y la reja de solo
lectura en `lib/auth/`. Los tests que afirman la pantalla vacía (`tests/mi-dia.test.ts`, `tests/acciones-mi-dia.test.ts`)
y `tests/vista.test.ts`, `tests/rol-de-vista-centralizado.test.ts`, `tests/paginas.test.ts`.

## Done cuando

- Un closer con dos programas ve su perfil, su Calendly por programa y, por programa, pendientes, deals, llamadas y
  students; nada de otro closer ni de otro programa (forjar el programa en la URL: 404).
- El developer elige "Ver como Nicolás" y ve exactamente lo de Nicolás; cualquier escritura forjada en esa vista da
  el mensaje de solo lectura y la base no se mueve (se muerde con la cabecera `Next-Action`, AGENTS.md).
- Un closer real con la cookie puesta a mano no suplanta a nadie.
- `npm run build` en verde; recorrido en `dev:local` como closer, como developer y "como closer", escritorio y 375 px.
