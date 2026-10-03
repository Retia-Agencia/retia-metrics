---
id: 177
etapa: O3
serves: "Revisión de la sesión central de la parte 2 (3-oct): hallazgos del recorrido de 172 y 176; ADR 0028 (enmienda del 172)"
depends: [172, 176]
status: done
---

# 177 — Pulido de la parte 2: Reagendada cierra la cita vieja, la reja deja leer y Mi espacio habla claro

Sesión **S10**, ola O3 parte 3. Sin migración. Sale del recorrido de la sesión central del 3-oct sobre 172 y 176.

## Por qué existe

El recorrido en `dev:local` encontró tres cosas que ningún test veía:

1. **"Resultado → Reagendada" deja la cita vieja colgada (176).** `AccionesDeLlamada` llama `agregarLlamadaAccion`, que
   crea la cita nueva pero no toca la vieja: queda `agendada` sin resultado para siempre, sigue saliendo en "Llamadas
   que ya pasaron sin resultado" del Inbox y en Pendientes. El enum ya tiene `reagendada` y Calendly ya lo hace bien
   (`lib/calendly/eventos-de-cita.ts`): marca la vieja `reagendada` y crea la nueva.
2. **La reja de solo lectura bloquea también las LECTURAS que van por server action (172).** `requireSession` rechaza
   toda petición con `next-action`, y dos acciones solo leen: `revisarMovimientoAccion` (el ensayo del motor que pinta
   lo que falta en el pop-up de mover) y `buscarDealsAbiertosAccion` (el buscador del Inbox). Viendo como un closer, el
   developer no puede ver qué le falta a un deal para moverse, que es justo lo que quiere revisar.
3. **Textos y detalles de la vista suplantada y de Mi espacio:**
   - El developer en su propio Mi espacio ve "Todavía no tienes programas asignados; pídele a tu gerente…": no aplica
     al dueño (ADR 0025). Para quien `esAccesoTotal`, el mensaje explica que Mi espacio es de quien trabaja leads y
     ofrece "Ver como closer".
   - El perfil de Mi espacio muestra el correo como nombre aunque `users.nombre` exista (local: "Carlos Closer").
   - Al hacer scroll, la barra "Estás viendo como…" se monta sobre la cabecera de la página.
   - En el diálogo "Resultado", el botón "Elige una opción" se ve activo aunque está deshabilitado: quitarlo (las
     cuatro opciones ya son botones).
   - El 403 de un closer contra Canales dice "Esta vista es solo para: gerente, paid_trafficker": el rol crudo. Usar la
     etiqueta del rol (la que ya usa el perfil).

## Alcance

1. **Reagendada** en un solo acto: marcar la cita vieja `reagendada` y crear la nueva en la MISMA transacción, con su
   rastro (`crearConRastro`/`editarConRastro`). Si ya existe una función de `lib/deals/llamadas.ts` o de
   `lib/calendly/` que lo haga, se reutiliza; no se copia la lógica. Test: después de Reagendada, la vieja no sale en
   "ya pasaron sin resultado".
2. **Lecturas por server action:** una forma explícita y única de decir "esta acción solo lee" en `lib/auth/guards.ts`
   (por ejemplo `requireSessionDeLectura()`), que no aplica la reja. Solo la usan `revisarMovimientoAccion` y
   `buscarDealsAbiertosAccion`. Guardián: un test que liste las acciones que la usan y falle si aparece una nueva sin
   nombrarla (la lista ES la excepción, como `TABLAS_PUENTE_BORRABLES`). Mordida: bajo suplantación, el ensayo
   devuelve la lista de faltantes y un `moverDeal` forjado sigue dando el 403 de solo lectura.
3. Los cinco detalles del punto 3.

4. **"Show" se marca y ya; el Grain no bloquea (decisión de Mani, 3-oct).** Hoy "Show" solo pone el foco en el campo
   de Grain. Pasa a marcar la llamada `show` en un clic (una acción nueva en `lib/deals/llamadas.ts`, hermana de
   `pegarGrain`, que hace lo mismo sin el link: `resultado = "show"`, `fecha_llamada` y el movimiento a Atendido por E8,
   en una transacción y con rastro). El motor ya lo permite: `llamada_sucedio` se cumple con `resultado = "show"`
   (`RESULTADOS_QUE_OCURRIERON`); solo cambia el mensaje del requisito en `lib/deals/requisitos.ts` ("Falta marcar la
   llamada como show", no "Falta el link de Grain"). El Grain sigue siendo un campo para pegar el transcript, opcional:
   pegarlo marca show si no lo estaba (lo de hoy). **Una llamada show sin Grain no bloquea ningún movimiento: sale
   como alerta amarilla en la ficha** ("La llamada no tiene el link de Grain") y en la métrica "Shows sin Grain" que ya
   existe; nunca como requisito. Tests: marcar show sin Grain mueve a Atendido; el deal sigue a Compromiso Verbal sin
   Grain; la alerta aparece y desaparece al pegarlo.

## Archivos

`components/deals/ficha/acciones-de-llamada.tsx`, `lib/deals/llamadas.ts` (solo si Reagendada necesita juntar dos
pasos), `lib/auth/guards.ts`, `app/(app)/p/[programa]/deals/acciones.ts`, `app/(app)/p/[programa]/inbox/acciones.ts`,
`app/(app)/mi-espacio/page.tsx`, `components/mi-espacio/perfil-de-mi-espacio.tsx`, `components/barra-suplantacion.tsx`,
`app/(app)/ajustes/canales/acciones.ts`, `lib/deals/requisitos.ts` (solo el mensaje), la alerta en `ficha-alertas.tsx`. Tests: `tests/llamadas-del-deal.test.ts`, `tests/reja-solo-lectura.test.ts`,
`tests/mi-espacio.test.ts`.

**No toca** `components/page-shell.tsx` ni los enlaces de las listas (son del 174) ni lo que borra el 175.

## Done cuando

- Reagendada desde la ficha deja la cita vieja `reagendada` y una nueva `agendada`; el Inbox ya no muestra la vieja.
- Viendo como un closer, el pop-up de mover muestra lo que falta; cualquier escritura forjada sigue en 403 y la base
  no se mueve (se muerde con `Next-Action`).
- "Show" se marca en un clic sin Grain, el deal pasa a Atendido y sale la alerta amarilla; pegando el Grain se va.
- Los cinco detalles, vistos en `dev:local` como closer, developer y "como closer", escritorio y 375 px.
- Typecheck, lint, los tests del ticket y `npm run build` (hay componentes cliente).

## Estado (S10, 3-oct)

Implementado por Kiro en `wt-177` (rama `o3-177-pulido`), revisado el diff por Claude. Sin commit ni push todavía.

- Hecho: Reagendada en un acto (`reagendarLlamada`), Show en un clic (`marcarShow`, cuerpo común con `pegarGrain`), guarda de lectura
  (`requireSessionDeLectura`/`requireRoleDeLectura` + `ACCIONES_DE_SOLO_LECTURA` con guardián), mensaje del developer, nombre en el
  perfil, barra de suplantación sin `sticky`, diálogo Resultado sin botón muerto, `etiquetaDeRol` única en `lib/auth/roles.ts`.
- Verificado (3-oct): typecheck, lint y `npm run build` limpios; tests del ticket y vecinos en verde (llamadas-del-deal, reja-solo-lectura,
  mi-espacio, roles, alertas-del-deal, guards, paginas, ficha-deal-*, vigencia, rol-de-vista, rastro, inbox). Dos tests ajenos cayeron y
  se arreglaron: el texto de la alerta en `alertas-del-deal` y una excepción nombrada para `mi-espacio/page.tsx` en `rol-de-vista-centralizado`.
- Recorrido por curl en `dev:local`: Mi espacio muestra "Carlos Closer" al closer y el mensaje "Ver como closer" al developer.
- Pendiente para la sesión central (con browser): clics en Resultado/Show/Reagendada, barra "Estás viendo como…" con scroll, 375 px,
  y la mordida con `Next-Action` (el guardián de `reja-solo-lectura.test.ts` ya la cubre contra las guardas reales).
- Aviso: `components/deals/responder-pregunta.tsx:323` tiene el mismo botón muerto "Elige una opción" (archivo del 176, no se tocó).
- Fuera de la lista del ticket, tocados a propósito: `deals/[id]/acciones.ts`, `components/deals/ficha/campos.tsx` (confirmar opcional en
  `DialogoForm`), `components/user-menu.tsx`, `lib/auth/roles.ts`.
- Causa del nombre en Mi espacio (no aplicada): `lib/auth/config.ts` no mapea `users.nombre` a la sesión; el 177 lo lee de la membresía.
  Raíz: `token.nombre` en `revalidarToken` y `session.user.name` en el callback.

## Recorrido de la sesión central (3-oct, noche) · DONE en `cp-20261003-5`

Con navegador, en `dev:local`: "Resultado → Show" sin Grain mueve a Atendido ("Marcada como show: el deal pasó a
Atendido"), habilita "Registrar abono" y deja la alerta "La llamada no tiene el link de Grain"; pegando el Grain se guarda
y la alerta se va. "Reagendada" deja la vieja `reagendada` y la nueva `agendada` (10:30 de Bogotá = 15:30 UTC). Viendo
como Carlos, el pop-up de mover hace el ensayo (`ok: true`, "Falta el motivo") y Confirmar devuelve el aviso de solo
lectura (403), no una pantalla de error. Hallazgo: tras Show el campo de Grain queda escondido en "Llamadas anteriores"
(colapsada). Va al **180** con el botón muerto de `responder-pregunta.tsx`.
