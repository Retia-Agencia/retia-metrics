---
id: 179
etapa: O3
serves: "Decisión de Mani (3-oct): Mi espacio curado por rol; ADR 0077 punto 1; cierra la decisión abierta del 172"
depends: [172, 173]
status: todo
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
