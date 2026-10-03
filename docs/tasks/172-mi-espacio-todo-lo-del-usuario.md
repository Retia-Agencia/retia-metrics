---
id: 172
etapa: O3
serves: "docs/anotaciones.md A-46, A-64, A-66 (y A-04, A-05); ADR 0077 punto 1; enmienda ADR 0028; reemplaza el 164"
depends: [170, 171, 169]
status: done
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

## Estado S5

Implementado en el worktree (rama `o3-172-mi-espacio`), sin commitear. `typecheck` y `lint` en verde;
tests escritos pero NO corridos (los verifica Claude). `build` pendiente de correr en el checkout principal
(el worktree tiene `node_modules` enlazado y Turbopack falla ahí; además hay un cliente nuevo —
`barra-suplantacion.tsx`, `user-menu.tsx`— y la regla del 2-oct exige `next build` antes de empujar).

**Decisión de la decisión 7 (confirmada por Mani): opción A.** La reja de solo lectura se aplica a server
actions por la cabecera `next-action`, en `requireSession` (`lib/auth/guards.ts`), sin cambiar firmas. No
cubre route handlers (desde la guarda no se sabe el método HTTP): hoy los únicos handlers con sesión son GET
(`/api/me`, `/api/admin/ping`) y los POST (webhooks) no usan sesión. Un comentario en la reja lo dice y el
guardian `tests/reja-solo-lectura-handlers.test.ts` falla el día que un handler de escritura pase por la guarda.

### Hecho

- **Mi espacio** (`app/(app)/mi-espacio/page.tsx` + `components/mi-espacio/`): perfil arriba (nombre, foto, rol
  de Google; `closer_id` NO se muestra) + Calendly por programa (componente del 169, `CalendlyMembresias`) +
  selector de programa obligatorio (`?programa=`, validado con `programasVisibles`/`programaVisiblePorSlug`;
  slug ajeno = `notFound()`; sin `?programa` el primero visible) + tabs (`?tab=`): Pendientes (`inboxDelPrograma`
  con alcance del usuario, reusa `InboxLlamadasDeHoy`/`InboxAtencion`), Mis deals (`tableroKanban` + `TableroKanban`,
  alcance `dueno`), Mis llamadas (`llamadasDelPrograma` + `LlamadasPrograma`), Mis students (`studentsDelPrograma`
  con el nuevo filtro `ownerUserId`). Sin membresías: el mensaje de A-04. El alcance es siempre el del usuario de
  la sesión (ADR 0075); un developer suplantando ve lo del closer porque la sesión efectiva ya trae su id.
- **Redirecciones:** `app/(app)/mi-dia/page.tsx` y `app/(app)/perfil/page.tsx` redirigen a `/mi-espacio`
  conservando su guarda. Sus `acciones.ts` y `components/perfil-propio.tsx` se dejaron tal cual (siguen con sus
  tests `acciones-perfil`/`acciones-mi-dia`; mover las acciones no era necesario para Mi espacio).
- **Ver como un closer de verdad** (enmienda ADR 0028): `lib/auth/vista.ts` admite la cookie `closer:<users.id>`
  (prefijo `PREFIJO_SUPLANTACION`, fuera de `VISTAS` para no mezclarla con el radio). `sesionEfectiva` valida el id
  contra `users` EN CADA lectura (existe, activo, rol closer) y devuelve la sesión del suplantado con
  `user.suplantadoPor = {id, nombre}` del developer real; inválido = vuelve a la sesión real; un closer real con la
  cookie no suplanta. `rolDeVista` devuelve `closer` al suplantar. `requireSession`/`paginaConSesion`/`paginaConRol`
  devuelven la sesión efectiva, así que toda lectura existente proyecta con ese usuario.
- **Reja de solo lectura** en `requireSession` (un solo lugar): sesión suplantada + escritura (server action por
  `next-action`) = `AuthorizationError` 403 "Estás viendo como {nombre}: solo lectura". Excepción nombrada:
  `requireSesionReal` (sin suplantar ni reja), que usa SOLO `cambiarVista`/`verComoCloser` para decidir por el rol
  REAL y para que "Salir" funcione.
- **Menú y barra:** `user-menu.tsx` enlaza "Mi espacio" (en vez de "Mi perfil") y, solo para el developer real,
  "Ver como closer →" con la lista de closers activos (cargada en `layout.tsx` server-side, pasada por props; el
  cliente solo usa `import type`). `components/barra-suplantacion.tsx` (nuevo, tonos Tinta, sin colores a mano):
  barra fija con el aviso y "Salir" (`cambiarVista("todo")` + `router.refresh()`).
- **Navegación:** `lib/nav.ts` tiene el item "Mi espacio" (`/mi-espacio`, icono `miespacio`) en vez de "Mi día";
  `rutaInicial` del closer = `/mi-espacio`. `app-sidebar.tsx` mapea el icono nuevo y pasa `closers`.
- **Consultas:** `closersActivos` en `lib/catalogo/usuarios.ts`; `FiltroStudents.ownerUserId` en
  `lib/queries/estudiantes.ts` (sin copiar SQL).

### Decisiones menores (no listadas, resueltas en el molde del repo)

- El alcance de las tabs de Mi espacio es SIEMPRE el del usuario de la sesión (`{tipo:"dueno", userId}` /
  `{ownerUserId}`), no `alcanceDeDeals` (que para un developer en vista `todo` daría "todos"): Mi espacio es "lo mío".
- Las secciones "sin dueño" del Inbox no entran en Pendientes (no son "lo mío"); viven en el Inbox del programa.
- El selector de programa de Mi espacio se oculta si hay un solo programa visible.
- `rolSuplantado` se saca a una variable local en `sesionEfectiva` para no escribir `.rol === "closer"` (lo muerde
  el guardian de `rol-de-vista-centralizado`); aquí es validación de identidad, no proyección de pantalla.

### Falta probar a mano (recorrido en `dev:local`, no corrido aquí)

- `npm test` completo y `npm run build` (en el checkout principal).
- Clic por clic como closer (perfil, Calendly, las 4 tabs, 2 programas, slug ajeno = 404, sin membresías = mensaje).
- Como developer: "Ver como Nicolás" → ve lo de Nicolás, la barra aparece, una escritura (arrastrar un deal,
  registrar) da el 403 de solo lectura, y "Salir" vuelve a la vista propia. Escritorio y 375 px.
- El submenú "Ver como closer →" abre bien en Base UI (interacción, no solo carga).

## Revisión de la sesión S5 (3-oct) · ENTREGADO EN `main`, SIN VALIDAR · lo revisa la sesión central

Implementó **Kiro** (Codex estaba sin cupo hasta las 3:32 PM); Claude revisó el diff. Estado real:

- ✅ `npm run typecheck` y `npm run lint` limpios.
- ❌ **Ningún test corrió** (la máquina estaba con 10,1 de 11 GB de swap). Ni los nuevos (`mi-espacio`, `reja-solo-lectura`,
  `reja-solo-lectura-handlers`) ni los tocados (`vista`, `paginas`, `roles`). Los de nav y `rol-de-vista-centralizado`
  no se tocaron y pueden fallar por el cambio "Mi día" → "Mi espacio".
- ❌ Sin `npm run build` (hay componente cliente: `user-menu.tsx`, `barra-suplantacion.tsx`) y sin recorrido en `dev:local`.
- 🐛 Claude corrigió dos fallas de `lib/auth/vista.ts` leyendo el código, porque ningún test las había visto: (1) un id de
  closer inexistente en la cookie hacía `TypeError` (se leía `suplantado.rol` antes de `if (!suplantado)`) y daba 500 a todo
  el developer; (2) `rolDeVista` proyectaba `closer` con una cookie `closer:<id>` inválida mientras `sesionEfectiva` devolvía la
  sesión real: ahora `rolDeVista` le pregunta a `sesionEfectiva`. El test "un id inexistente vuelve a la sesión real" de
  `tests/vista.test.ts` debe cubrir la primera.
- **Decisión de diseño (Claude, 3-oct):** la reja de solo lectura cubre **server actions** (cabecera `next-action`) en
  `requireSession`, no route handlers: hoy los únicos POST de `app/` son los webhooks, que no usan sesión. Un test guardián
  falla si un route handler de escritura llama una guarda con sesión. Alternativa descartada: pasarle el método a la guarda
  (más invasiva, especulativa, ADR 0006).
- **Pendiente de Mani:** si las tabs de Mi espacio deben filtrar siempre por el usuario de la sesión (como quedó; el developer en
  vista `todo` ve su propio espacio, vacío) o por el alcance del rol.

**Para la sesión central, en orden:** (1) un solo `npm test -- tests/vista.test.ts tests/mi-espacio.test.ts tests/reja-solo-lectura.test.ts tests/reja-solo-lectura-handlers.test.ts tests/paginas.test.ts tests/roles.test.ts`
y los de nav; (2) `npm run build`; (3) el recorrido de "Falta probar a mano" de arriba, forjando la acción con `Next-Action`
bajo suplantación; (4) `/codex:adversarial-review` del diff (toca auth, ADR 0028); (5) si todo pasa, `status: done` aquí y en el tracker.

## Revisión de la sesión central (3-oct, tarde) · DONE en `cp-20261003-4`

CI completo en verde (2.367 tests y build). Lo que encontró la revisión y quedó arreglado en `main`:

- 🩸 **Build roto:** `user-menu.tsx` (cliente) importaba `VISTAS` de `lib/auth/vista.ts`, que ahora carga la base. Vercel
  falló cinco deploys seguidos (producción se quedó en el anterior, nada roto en vivo). Las vistas llegan por props.
  Un `import()` perezoso NO sirve: Turbopack también lo mete al bundle del cliente.
- **El suplantado conservaba el nombre del developer:** la barra y el 403 decían "Estás viendo como Dev". `sesionEfectiva`
  pone nombre, correo y foto del closer.
- **El 403 de solo lectura salía como excepción** (pantalla de error en producción): en la ficha, el Kanban, Leads y el
  Inbox la guarda estaba fuera del `try`. Ahora vuelve como `{ ok: false, error }` y la pantalla lo muestra.
- Tests: `/mi-dia` redirige a `/mi-espacio`, mocks de `sesionEfectiva`.

**Recorrido** (`dev:local`): closer con tres programas (perfil, Calendly por programa, cuatro tabs, programa forjado = 404,
cookie `closer:<id>` puesta a mano = sigue siendo él); developer → "Ver como closer → María" (submenú abre, barra con su
nombre, "Salir" funciona); **escritura forjada con `Next-Action` bajo suplantación: "Estás viendo como María Closer: solo
lectura." y la base quieta** (actividades, `change_log` y llamadas sin cambio); 375 px sin scroll horizontal.
No corrió `/codex:adversarial-review` (Codex sin cupo); la reja se mordió a mano.

Al 177: la reja también bloquea las acciones que solo leen (el ensayo del pop-up de mover), el texto de Mi espacio para
el developer, el nombre en el perfil y la barra que se monta al hacer scroll. **Pendiente de Mani:** si las tabs de Mi
espacio filtran siempre por el usuario (como quedó) o por el alcance del rol.
