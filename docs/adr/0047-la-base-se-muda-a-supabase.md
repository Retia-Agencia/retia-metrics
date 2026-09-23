# 0047 — La base se muda a Supabase, con `postgres-js` y transacciones de verdad

**Fecha:** 2026-09-22 · **Estado:** aceptado (Alejandro y Mani, chat del 22-sep) ·
**Reemplaza:** ADR 0018 (ramas de Neon) · **Enmienda:** ADR 0042 (la razón por la que se
descartaron los triggers ya no existe), la convención de AGENTS.md sobre `neon-http` ·
**Origen:** `docs/auditorias/revision-modelo-hubspot-2026-09-22.md`, fichas R1, R11, S1 y S2

## Por qué

1. **Archivos.** Mani: *"todo CRM debe poder tener archivos; lo básico son los comprobantes de cada
   venta"*. El comprobante en foto (ticket 035) deja de ser opcional, y Supabase trae Storage al lado
   de la base. Neon no tiene almacenamiento de archivos.
2. **Transacciones.** Con `drizzle-orm/neon-http` cada consulta era una petición HTTP suelta: no
   había forma de leer, decidir y escribir en la misma transacción. El motor de etapas (`moverEtapa`,
   E2) y un abono que valida el saldo lo necesitan. Además, `ejecutarJuntas` tenía dos caminos:
   `batch` en producción y `transaction` en los tests. **El que corría en producción no lo probaba
   ningún test.**

La revisión del 22-sep había recomendado resolver el punto 2 sin moverse de Neon (R11). Lo que
inclinó la decisión fue el punto 1.

## Qué se decide

1. **Driver: `drizzle-orm/postgres-js`**, con `prepare: false`. Es el que documenta Supabase para
   Drizzle. `ejecutarJuntas` es una transacción real en los dos entornos, y ejecuta **en orden**.
   Desaparece el tipo `NeonHttpDatabase` y con él la bifurcación.
2. **Dos conexiones:**
   - la app entra por el **pooler en modo transaction (puerto 6543)**, en `DATABASE_URL`, porque es
     el que aguanta funciones serverless;
   - `drizzle-kit` entra por la **conexión directa o el pooler en modo session (puerto 5432)**, en
     `DATABASE_URL_DIRECTA`.

   🩸 El modo transaction **no admite prepared statements**: sin `prepare: false`, la segunda consulta
   revienta solo en producción, porque PGlite no pasa por ningún pooler.
3. **Dos proyectos, no ramas:** `dev` y producción, en una organización de Retia, **en plan gratis
   por ahora** y en `us-east-1`, junto a las funciones de Vercel. Las ramas de Supabase exigen Pro y
   nacen sin datos, así que no dan lo que daban las de Neon (copia instantánea de producción).
   ⚠️ **Riesgo aceptado:** en plan gratis un proyecto **se pausa tras 7 días sin uso**. Pasar
   producción a Pro es la primera compra cuando haya operación real.
4. **Se arranca con la base vacía** (Mani, 22-sep: *"vale mierda ahorita"*). No se copian los datos
   de Neon. La base se levanta con las migraciones de `drizzle/` y se siembra con los scripts que ya
   existen para una base vacía (`seed:users`, `seed:datos`, `cargar-enlaces-pago`, excepción nombrada
   del ADR 0029). Los leads vuelven con el traslado desde Sheets, por la misma puerta de
   `lib/ingesta/`.
5. 🩸 **La Data API de Supabase se apaga en los dos proyectos** (o, si no se puede, se activa RLS sin
   políticas en todas las tablas de `public`). Supabase publica esas tablas por REST con una llave
   anónima; la app no usa esa API, así que dejarla abierta expone los leads sin ningún beneficio.
   Es la regla "nada de la app es público" aplicada a la base.
6. **Auth sigue siendo Auth.js** (ADR 0002). Supabase Auth no entra: cambiarlo no resuelve nada que
   hoy duela.
7. **Los archivos van a Supabase Storage**, en un bucket privado, **detrás de una interfaz propia**
   (`lib/archivos/`) y con URLs firmadas desde el servidor. Llega con el ticket 035, no antes (ADR
   0006).
8. **El código queda portable** (lo que quedaba de R11): ningún import de un SDK de Supabase fuera
   de `lib/db/` y `lib/archivos/`, y solo SQL de PostgreSQL estándar.

## Lo que NO cambia

- **La exclusión mutua sigue viviendo en índices únicos** (ADR 0005, 0031). Nació así porque
  `neon-http` no tenía sesión. Se conserva porque con el pooler en modo transaction un
  `pg_advisory_lock` de sesión tampoco sobrevive entre consultas, y porque un índice no hay que
  acordarse de soltarlo si la función muere a la mitad.
- **Los tests siguen en PGlite** (ADR 0020), con todas las migraciones reales aplicadas.
- **El SQL de `drizzle-kit` se lee antes de aplicarlo**, y **toda escritura en producción pide el ok
  de Mani**.

## Consecuencias

- **Los triggers de rastro (R2) vuelven a ser posibles.** El ADR 0042 los descartó porque con
  `neon-http` el trigger no podía saber quién escribía. Con una transacción real,
  `SET LOCAL app.user_id` lo resuelve. Queda como decisión aparte.
- **Los scripts de `scripts/` salen con `process.exit`.** `postgres-js` mantiene un pool abierto y
  un script que no sale explícitamente se queda colgado.
- 🩸 **Un componente `"use client"` no puede importar un módulo que toque la base.** Al cambiar
  el driver, el build se cayó: `recursos-pantalla.tsx` importaba `MONEDAS` de
  `lib/catalogo/enlaces-pago.ts`, que arrastra `lib/db`, y `postgres` necesita sockets de Node.
  **Con Neon, que usa `fetch`, el cliente de la base se empaquetaba en el navegador sin error**
  desde hacía semanas. Ahora el build es el guardián. `MONEDAS` quedó en `lib/monedas.ts`, un
  módulo puro, y de paso dejó de estar escrita dos veces (productos y enlaces de pago).
- **Se pierde `neon.branch_id`** como forma de comprobar a qué base apunta una variable. El
  equivalente es el *ref* del proyecto dentro de la connection string
  (`postgres.<ref>@...`): **antes de escribir, se mira el ref, no el nombre de la variable.**
