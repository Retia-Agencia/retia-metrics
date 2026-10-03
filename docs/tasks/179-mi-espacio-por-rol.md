---
id: 179
etapa: O3
serves: "Decisión de Mani (3-oct): Mi espacio curado por rol; ADR 0077 punto 1; cierra la decisión abierta del 172"
depends: [172, 173]
status: done
---

# 179 — Mi espacio curado por rol: cada quien ve solo lo suyo y solo lo de su trabajo

Sesión **S12**, ola O3 parte 3. Sin migración. Toca `app/(app)/mi-espacio/` y `components/mi-espacio/`: va **después**
del 177 (que cambia el texto del developer en la misma página) o rebasa sobre él.

## La decisión (Mani, 3-oct)

El 172 dejó las tabs de Mi espacio filtradas por el **usuario** (lo mío como dueño) y preguntó si debían ir por el
**alcance del rol** (todo lo que el rol puede ver, por ejemplo un gerente vería los deals de todos). Mani: **ninguna de
las dos sola. Mi espacio muestra SOLO lo que le corresponde a esa persona, y QUÉ se muestra depende de su rol**: lo que
hace un Paid Trafficker no lo hace un Closer, y lo que hace un Gerente no lo hace un Customer Success.

Dos ejes que no se mezclan:
- **De quién:** siempre de la persona (sus deals, sus llamadas, sus canales). Nunca "todo lo que el rol alcanza": eso
  vive en las tabs del programa (Deals, Calls, Dashboard).
- **Qué secciones:** las del trabajo de su rol.

## Alcance

1. **Un registro, no un `if` por pantalla:** `lib/mi-espacio/secciones.ts` (o junto a `lib/nav.ts`) declara cada
   sección con la pregunta de capacidad que la habilita (`trabajaLeads`, `manejaPauta`, `esAdministrador`, …, de
   `lib/auth/roles.ts`; nunca `rol === "..."`). La página pinta las secciones que el rol de vista cumple. Cuando llegue
   Customer Success (145), es una pregunta nueva en `roles.ts` y una fila aquí.
2. **Las secciones de hoy:**
   - Quien `trabajaLeads` (closer, setter): Pendientes, Mis deals, Mis llamadas, Mis students (lo que ya hay).
   - Quien `manejaPauta` sin trabajar leads (paid trafficker): sus canales y los pares sin clasificar de sus
     programas. **Su `rutaInicial` pasa a Mi espacio** (hoy aterriza en `/ajustes/canales`).
   - Quien administra (gerente): **a definir con Mani en la sesión antes de construir.** Propuesta: lo que le toca
     decidir a él (deals sin dueño, llamadas sueltas, hosts sin cuenta, Webhook Health con alarma), no los deals de
     los closers.
   - El developer: ve las secciones de la vista que tenga ("Ver como" un closer muestra lo del closer); en `todo`, un
     mensaje que lo explica.
3. Perfil arriba igual para todos (nombre, foto, rol); Calendly solo para quien `trabajaLeads`.

## Done cuando

- Closer, paid trafficker y gerente ven cada uno solo sus secciones y solo sus datos; forjar `?tab=` de otra sección
  da 404 o vuelve a la primera, nunca la muestra.
- Ninguna sección pregunta por el literal del rol (el guardián de `rol-de-vista-centralizado` lo caza).
- Typecheck, lint, tests de `tests/mi-espacio.test.ts`, `npm run build`; recorrido en `dev:local` con los tres roles y
  "Ver como", escritorio y 375 px.

## Estado S12 (3-oct)

Decisión de Mani para el gerente: sección **Por decidir** (deals sin dueño y por settear, llamadas sueltas, hosts sin cuenta,
Webhook Health con alarma), sin Calendly; las métricas siguen siendo del Dashboard. Paid trafficker: sección **Canales** (pares
sin clasificar y envíos por canal, sin filtrar por membresía: no tiene), su `rutaInicial` es Mi espacio.

Implementado (Kiro) y revisado contra el "Done cuando": registro `lib/mi-espacio/secciones.ts`, `tab-canales`, `tab-por-decidir`,
`hosts-sin-cuenta` (extraído del Inbox), página y nav. `typecheck`, `lint` y 160 tests (mi-espacio, secciones, roles, paginas,
rol-de-vista) en verde. **Sin recorrido en navegador** (extensión de Chrome desconectada) ni `npm run build` (sin componentes
cliente nuevos); tests del inbox sin correr (máquina sin aire): valida el CI. Pendiente para la sesión central: recorrido
con los tres roles y "Ver como", escritorio y 375 px, y forjar `?tab=`.

Abiertas: el gerente no puede colgar llamadas sueltas (no trabaja leads); un developer en vista `closer` sin membresías ve el
mensaje del closer, no el del dueño.

## Recorrido y cierre (3-oct, sesión central)

En `dev:local`, escritorio y 375 px, sin scroll horizontal ni errores de la app en consola:

- **Closer** (carlos): Pendientes, Mis deals, Mis llamadas, Mis students y su Calendly. `?tab=canales`,
  `?tab=por-decidir` y `?tab=xyz` caen en Pendientes.
- **Gerente**: solo "Por decidir" (agendados sin dueño, por settear con "Asignar a…" que abre, sueltas, hosts sin
  cuenta, Webhook Health) con selector de programa; cualquier `?tab=` forjado cae ahí; `?programa=no-existe` da 404.
- **Paid trafficker**: aterriza en Mi espacio, solo Mi espacio y Ajustes en el menú; Canales con los pares sin
  clasificar y los envíos por canal; los `?tab=` de otras secciones caen en Canales.
- **Developer**: en `todo`, el mensaje; "Como gerente" ve lo del gerente; "Ver como" Carlos ve exactamente lo de Carlos.

**Arreglado en la revisión:** (1) el developer en "Como closer" (sin suplantar, sin membresías) veía "pídele a tu
gerente que te agregue"; vuelve a ver el mensaje del dueño, decidido por la cuenta real y solo si no está suplantando
(`requireSesionReal`, excepción ya nombrada en el guardián). (2) Ese mensaje decía que Mi espacio "es de quien trabaja
leads"; ahora explica que depende del rol y nombra "Como gerente" y "Ver como closer".

Queda abierto, sin ticket: el gerente ve las llamadas sueltas pero no las cuelga (las asigna un closer, ADR 0049); y el
menú "Ver como" no tiene "Como paid trafficker" (la vista solo estrecha a gerente o closer, ADR 0028).
