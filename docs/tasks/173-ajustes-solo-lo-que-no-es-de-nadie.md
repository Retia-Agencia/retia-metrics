---
id: 173
etapa: O3
serves: "docs/anotaciones.md A-72, A-73, A-74, A-81; ADR 0077 puntos 1 y 4; ADR 0052 (ticket 102)"
depends: [171]
status: done
---

> **3-oct (sesión central):** el valor `paid_trafficker` del enum `rol` **no** se adelantó: al agregarlo, `users.rol` deja de caber en `Rol` (`lib/auth/roles.ts`) y rompe `lib/catalogo/usuarios.ts`, `lib/deals/duenos.ts` y `scripts/usuarios.ts`. Va en el mismo cambio que `ROLES`, `manejaPauta` y la etiqueta del rol: la sesión entrega `schema.ts` y el código, y la sesión central genera y aplica la migración (`ALTER TYPE "rol" ADD VALUE IF NOT EXISTS 'paid_trafficker'`, con `SET lock_timeout`).


# 173 — Ajustes solo con lo que no es de nadie: Webhook Health, Canales del Paid Trafficker, Motivos y Áreas

Sesión **S6**, ola O3 parte 2 (después del 171). **Absorbe el 102** (el rol Paid Trafficker y `manejaPauta`), que
lleva migración: la genera y aplica la sesión principal con el ok de Mani; la sesión entrega el cambio de
`lib/db/schema.ts` y el código.

## Alcance

1. **Ajustes queda con cinco secciones:** Usuarios, Canales, Webhook Health, Motivos y Áreas. El índice
   (`app/(app)/ajustes/page.tsx`) pierde Programas, Fuentes y las pestañas de Catálogos que se fueron (Plataformas
   al 171, Orígenes y categorías de recurso al 175). La descripción del índice en una línea. **A-81:** toda tarjeta, ruta o texto de Ajustes que hable de algo que ya vive en Programa o Mi espacio se quita (Programas y cohortes, Fuentes de datos, "en qué programas vende cada closer" en Usuarios, la mención a Sheets y sincronización); `/ajustes/programas` y `/ajustes/fuentes` dejan de redirigir y se borran si nada las enlaza. "Rarezas de la migración" se queda hasta que el 078 cierre.
2. **Webhook Health (A-73).** "Salud del CRM" se llama **Webhook Health** (título, nav y textos). La lista de
   entregas muestra **las últimas 25** y pagina en el servidor bajo demanda ("Ver anteriores", cursor por fecha e
   id, sin `OFFSET` que crezca); `LIMITE_ENTREGAS = 200` de `lib/queries/entregas-webhook.ts` se va. El filtro usa el
   componente del 170.
3. **El Paid Trafficker (A-74, 102, ADR 0052).** Rol `paid_trafficker` en la base; la pregunta `manejaPauta` en
   `lib/auth/roles.ts` (la cumplen paid trafficker, gerente y developer; nunca un `rol ===` a mano). Ve Dashboard,
   Canales y lo de pauta de sus programas; no trabaja leads. Lo que dice el ticket 102 sigue valiendo donde no choque.
4. **Canales los crea quien `manejaPauta` (ADR 0077 punto 4).** Crear, editar y "Crear canal" desde un par sin canal
   piden `manejaPauta` en el servidor. La pantalla explica arriba, en una línea, por qué no se crean solos y cómo
   se arma un link con UTM (el builder, 092).
5. **Motivos y Áreas** quedan en una pantalla cada uno (o dos pestañas), con una línea que dice dónde se usan:
   Motivos al perder, retroceder o recuperar un deal; Áreas en el origen declarado y el rendimiento por área.

## Archivos

Suyos: `app/(app)/ajustes/page.tsx`, `ajustes/salud/*`, `ajustes/canales/*`, `ajustes/catalogos/*`,
`components/admin/entregas-webhook.tsx` (el 170 cambia antes un enlace; rebasar), `components/admin/canales-admin.tsx`,
`components/catalogos-admin.tsx`, `components/admin/areas-admin.tsx`, `lib/queries/entregas-webhook.ts`,
`lib/auth/roles.ts` (contrato transversal: el cambio lo aprueba Mani en la revisión), `lib/nav.ts` (solo los items de
Ajustes y del Paid Trafficker), `lib/db/schema.ts` (el enum de rol; la migración es de la sesión principal).

Tests: `tests/salud-crm.test.ts`, `tests/canales.test.ts`, `tests/roles.test.ts`, `tests/guards.test.ts`,
`tests/paginas.test.ts`.

## Done cuando

- Ajustes tiene cinco secciones; Webhook Health muestra 25 y carga más bajo demanda.
- Un paid trafficker crea un canal; un closer, forjando la acción, recibe 403 y la base no se mueve.
- `manejaPauta` vive solo en `lib/auth/roles.ts`; ningún `rol === "paid_trafficker"` fuera de ahí.
- Migración leída y aplicada por la sesión principal; `npm run build` en verde; recorrido en `dev:local`.

## Estado y nota de cierre (S6, 3-oct) · ENTREGADO SIN VALIDAR

**Para la sesión principal: revisa si la implementación ya está completa.** Implementó Kiro (el cupo de Codex se agotó hasta las 3:32 PM); Claude revisó el diff. Por decisión de Mani **no se corrieron tests** (swap 10,7 de 11,3 GB) ni `npm run build`. Typecheck y lint salieron limpios en el worktree.

**Por correr en la sesión central:** `npm test -- tests/roles.test.ts tests/paginas.test.ts tests/salud-crm.test.ts tests/canales-accion.test.ts tests/calendly-webhook-ruta.test.ts tests/rol-de-vista-centralizado.test.ts`, y `npm run build` (`components/admin/entregas-webhook.tsx` es cliente). Recorrido en `dev:local` y petición forjada de un closer a la acción de crear canal (espera 403 y base sin moverse).

**Migración pendiente (sesión principal, con ok de Mani):** `ALTER TYPE "rol" ADD VALUE IF NOT EXISTS 'paid_trafficker'` con `SET lock_timeout = '5s'`, **después de desplegar este código**. `schema.ts` ya tiene el valor.

**Hecho:** rol `paid_trafficker` y `manejaPauta` (solo en `lib/auth/roles.ts`); nav e inicio del rol por capacidad (solo Ajustes, aterriza en `/ajustes/canales`); Canales exige `manejaPauta` en página y acciones; Áreas en `/ajustes/areas`; Motivos titulada en `/ajustes/catalogos`; índice con Usuarios, Canales, Webhook Health, Motivos, Áreas y Rarezas de la migración; Webhook Health con 25 por página y cursor opaco por (fecha, id) sin `OFFSET`; `LIMITE_ENTREGAS` fuera.

**No hecho / decisiones abiertas:**
1. `/ajustes/programas` y `/ajustes/fuentes` **no se borraron**: `program-switcher`, `cohortes-admin`, `fuentes-admin`, `equipo-del-programa` y `editar-programa` importan sus `acciones.ts`. Solo se quitaron del índice. Mover esas acciones a Programa y borrar las rutas (A-81).
2. `/ajustes/catalogos` (Motivos) sigue admitiendo closers; solo el índice les oculta la tarjeta. Propuesta: solo administradores.
3. Fuera de alcance, sin construir: Dashboard del paid trafficker, su alcance por membresía (`lib/auth/alcance.ts`) y ocultarle el comparativo entre closers y la comisión.

**⚠️ `main` con typecheck roto al empujar el 173 (`1a9c555`), y no es del 173.** Cruce del 172 con el 176: `components/mi-espacio/tab-mis-llamadas.tsx:35` pasa `opciones` (+ `mapa`, `nombreDeEtapa`) a `llamadas-programa`, que tras el 176 pide `motivosReagenda` y ya no tiene `opciones`. Antes de rebasar sobre el 176 el typecheck del 173 estaba limpio. Lo arregla la sesión que dueña de esos archivos (S5 el tab, S9 `llamadas-programa`) o la central; el CI y el checkpoint saldrán rojos hasta entonces. Causa del push en rojo: un `typecheck | tail && git push` encadenado, donde `tail` ocultó el código de salida; ya no se encadena así.

## Revisión de la sesión central (3-oct, tarde) · código en `cp-20261003-4`, falta la migración

CI completo en verde. **Migración `0063_rol-paid-trafficker.sql` generada y leída** (`SET lock_timeout = '5s'` +
`ALTER TYPE "public"."rol" ADD VALUE IF NOT EXISTS 'paid_trafficker'`, aditiva). El código ya está desplegado, así que el
orden se cumple; **se aplica con el ok de Mani**. Hasta entonces, asignar el rol en producción falla con un error de enum.

**Recorrido** (`dev:local`): índice con las seis tarjetas; Webhook Health con 25 y "Ver anteriores" hasta 32 (sembradas 30
en local) sin errores; el paid trafficker aterriza en Canales, solo ve Ajustes y crea un canal; **un closer forjando
`crearCanalAccion` recibe 403 y la fila no existe**. Ojo: el 403 dice "solo para: gerente, paid_trafficker" (rol crudo, al 177).

Lo no hecho (rutas viejas de Programas y Fuentes, Motivos para closers) va al **178**. El Dashboard del paid trafficker
sigue fuera de alcance.

**3-oct, cierre:** 0063 aplicada en producción con el ok de Mani (ref `hfqmiyiuyqapdsbywrag`, 64 de 64, sin transacciones largas antes). El enum `rol` ya tiene `paid_trafficker`.
