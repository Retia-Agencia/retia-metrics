# Plan de remediación — revisión del 29 de agosto

> **Para quien ejecute con agentes:** este plan está pensado para ejecutarse tarea por tarea,
> con revisión entre tareas. Los pasos usan `- [ ]` para poder tacharlos.

**Objetivo:** aplicar los 33 hallazgos de [`docs/revision-2026-08-29.md`](revision-2026-08-29.md)
sobre el dashboard, en un orden en que cada tanda deja la app funcionando y testeada.

**Arquitectura del plan:** cuatro tandas. La 0 establece una línea base verificable (hoy no
existe). La 1 toca la superficie HTTP y de sesión, que no depende del sync. La 2 arregla el motor
de sincronización en orden de dependencia y termina en **una sola** re-sincronización. La 3 es
endurecimiento y las decisiones que hay que tomar con Michael.

**Stack:** Next 16.3.1 (App Router, `proxy.ts` en vez de `middleware.ts`), React 19.2.8,
Auth.js v5 beta, Drizzle + `neon-http`, Vitest 4, npm (no pnpm), `@base-ui/react`.

**Spec:** [`docs/revision-2026-08-29.md`](revision-2026-08-29.md) — commit auditado `a78bc8a`.
El plan discute contra ese documento; se leen los dos.

---

## Restricciones globales

Copiadas de `PROJECT.md` y `AGENTS.md`. Aplican a **todas** las tareas:

- **npm, nunca pnpm.** El lockfile es `package-lock.json`.
- **`proxy.ts`, nunca `middleware.ts`.** Next 16 lo renombró.
- **`@base-ui/react`**, no Radix. Los componentes de `components/ui/` ya están sobre esa base.
- **Un closer nunca ve datos de otro closer** (`PROJECT.md` regla 6). No hay herencia de roles:
  `gerente` y `closer` son conjuntos disjuntos, y `tests/roles.test.ts` lo fija.
- **Ante conflicto, gana Sheets** (`PROJECT.md` regla 7).
- **Solo cuentan los días hábiles** (`PROJECT.md` regla 3).
- **Fallar ruidosamente antes que adivinar.** Es la disciplina que ya tiene el repo
  (`MapeoInvalidoError`, `parsearFecha` devolviendo `null`); ninguna tarea la afloja.
- **Al cerrar cada tanda se actualiza `STATE.md`**, releyéndolo entero y corrigiendo lo que dejó
  de ser cierto, no solo agregando lo nuevo (es el hallazgo B-02).

---

## Correcciones de la auditoría al informe

Verifiqué los 33 hallazgos contra el código de `main` (`aa4bdf8`). **31 están exactos.** Dos
tienen imprecisiones que cambian el tamaño del trabajo, y hay un desajuste nuevo:

### A-1 · F-01 es más grande de lo que dice el informe

El informe dice: *"Agregar `estado` y `agenda` a `aRegistro`"*. Para `estado` es correcto: el campo
sobrevive el dedup (`PersonaDeducida.estado`, `dedup.ts:26`) y se pierde solo en `aRegistro`.

Para **`agenda` no alcanza**, porque se cae en tres capas antes:

| Capa | ¿Tiene `agenda`? |
|---|---|
| `MAPEO_FORMULARIO` (`mapeo.ts:71`) | sí |
| `PersonaDeducida` (`dedup.ts:16-31`) | **no** |
| `CAMPOS_TEXTO` (`dedup.ts:33-44`) | **no** |
| tabla `people` (`schema.ts:120-150`) | **no existe la columna** |
| `aRegistro` (`sync.ts:194`) | no |

Lo mismo, y peor, para `capacidadInvertir`: está mapeado y no existe en ningún otro lado.
`grep agenda lib/db/schema.ts` solo trae `fechaAgenda`, que es de la tabla de llamadas, y los
valores `agendada` / `reagendada` del enum `resultado_llamada`. Nada que ver.

**Consecuencia para el plan:** F-01 no es una línea, es una **migración de esquema** más cambios en
tres archivos. Va separado en la Tarea 2.7 y arrastra `npm run db:generate` + `db:migrate`.

### A-2 · `node_modules` no está instalado y nadie ha corrido la suite

El informe lo declara en su nota de método. Sigue siendo cierto hoy: `[ -d node_modules ]` da falso.
**Nadie ha verificado que los tests pasen**, ni el informe ni yo. Cada paso "corré el test" de este
plan es aire hasta que exista una línea base verde. Por eso la Tanda 0 existe y bloquea todo.

También significa que el número real de tests está sin confirmar: `STATE.md` dice 33 en la línea 52
y 11 en la línea 102, y el commit `a78bc8a` dice 35 en su mensaje. Tres números distintos.

### A-3 · Un cuarto desajuste de documentación que B-02 no lista

`STATE.md:43` describe `lib/sheets/sync.ts` como *"Lee, deduplica, hace **upsert** y escribe la
bitácora"*. No hace upsert: hace `insert` pelado por lotes e `update` fila por fila
(`sync.ts:142` y `sync.ts:162`). Es justamente la ausencia que causan F-03 y F-04.

Y `STATE.md:66` repite la afirmación falsa de S-02 con otras palabras: *"El rol se revalida contra
la DB en cada emisión de token"*. B-02 cita la línea 12; la 66 dice lo mismo y también hay que
corregirla.

### A-4 · Matiz sobre el costo de S-02

El informe dice que revalidar siempre es barato porque *"el callback `jwt` no corre en cada request
sino cuando se refresca el token"*. En Auth.js v5 con estrategia JWT, el callback `jwt` **sí corre
en cada lectura de sesión** del lado servidor. No corre en el proxy (que usa `authConfig`, sin DB),
pero sí en cada ruta Node que llama a `auth()`.

No cambia la recomendación: con menos de diez usuarios y una consulta por índice único, el costo es
irrelevante. Cambia el argumento, y conviene dejarlo escrito para que nadie lo "optimice" mal
después. La Tarea 1.1 lo marca con un comentario y deja anotado el camino de salida.

---

## Insumos bloqueantes (conseguir antes de la Tanda 2)

Tres cosas que no se pueden resolver leyendo código. Sin ellas, la Tanda 2 se traba a mitad.

- [ ] **Valores reales de la columna `Estado`** en las dos hojas. Se sacan con
      `npm run inspeccionar`, y hay que acordar con Michael el mapeo de cada texto a los seis
      valores del enum `estado_persona` (`descartado`, `cola_setteo`, `invitado`, `show`, `cierre`,
      `perdido`). **No inventar el mapeo.** Bloquea la Tarea 2.7.
- [ ] **Decisión sobre `agenda` y `capacidadInvertir`:** ¿se guardan (columna nueva) o se sacan del
      mapeo? Sin respuesta, quedan mapeados y muertos, que es peor que cualquiera de las dos.
      Bloquea la Tarea 2.7.
- [ ] **¿Se borran filas de las hojas alguna vez?** Si la respuesta es no, F-06 se cierra
      escribiéndolo en `STATE.md` como supuesto verificado y no se escribe código. Si es sí, hace
      falta la columna `ausenteDesde`. Bloquea la Tarea 3.6.

---

## Mapa de archivos

Lo que toca cada tanda. Sirve para ver los choques antes de empezar.

| Archivo | Tanda | Qué le pasa |
|---|---|---|
| `lib/errors.ts` | 1 | **nuevo** — clase base `ErrorDeApp` con `status` |
| `lib/auth/roles.ts` | 1 | los dos errores pasan a extender `ErrorDeApp` |
| `lib/auth/guards.ts` | 1 | `respuestaDeError` decide por `instanceof ErrorDeApp` |
| `lib/auth/index.ts` | 1 | revalidación de rol en cada emisión (S-02) |
| `lib/auth/config.ts` | 1 | `maxAge` + rol `null` en vez de `"closer"` (S-02, S-03) |
| `types/next-auth.d.ts` | 1 | `rol: Rol \| null` |
| `app/api/sync/[programa]/route.ts` | 1 | borra su rama de 422 (S-04) |
| `app/api/cron/sync/route.ts` | 1 | `timingSafeEqual` + respuesta con conteos (S-07) |
| `app/login/page.tsx` | 1 | valida `desde` (S-11) |
| `next.config.ts` | 1 | cabeceras de seguridad (S-05) |
| `lib/sheets/dedup.ts` | 2 | fecha ausente no pisa (F-02) + campos nuevos (F-01) |
| `lib/sheets/mapeo.ts` | 2 | zona horaria fija (F-05), coincidencia exacta (F-09) |
| `lib/sheets/leer.ts` | 2 | escapar apóstrofo (F-08) |
| `lib/sheets/planificar.ts` | 2 | **nuevo** — la decisión pura, testeable (B-01) |
| `lib/sheets/sync.ts` | 2 | queda como envoltorio de E/S; upsert por lotes (F-03, F-04) |
| `lib/db/schema.ts` | 2 | columnas nuevas en `people` y `sync_runs` (F-01, F-07) |
| `drizzle/` | 2 | migraciones generadas |
| `scripts/*.sh` | 3 | `set -e`, stdin, respaldos (B-07, B-08, S-08, S-09) |
| `lib/db/index.ts` | 3 | cliente perezoso (B-05) |
| `STATE.md` | todas | se corrige al cerrar cada tanda (B-02) |

---

# TANDA 0 — Línea base verificable

**Bloquea todo lo demás.** Sin esto, ningún "corré el test" de este plan significa nada.

### Tarea 0.1: Instalar dependencias y fijar la línea base

**Archivos:**
- Modificar: `STATE.md` (los dos conteos de tests)

- [ ] **Paso 1: Instalar**

```bash
npm install
```

- [ ] **Paso 2: Correr las tres verificaciones y anotar el resultado real**

```bash
npm test 2>&1 | tail -20
npm run typecheck
npm run lint
```

Esperado: los tres pasan. **Si alguno falla, parar acá y arreglarlo antes de seguir.** Un plan de
remediación que arranca sobre rojo no puede distinguir lo que rompió de lo que ya estaba roto.

- [ ] **Paso 3: Corregir el conteo de tests en `STATE.md`**

`STATE.md:52` dice "33 pasando" y `STATE.md:102` dice "11 tests de Vitest pasando". Reemplazar
**los dos** por el número que imprimió `npm test`. Un solo número, en los dos lugares.

- [ ] **Paso 4: Commit**

```bash
git add STATE.md
git commit -m "docs: corregir el conteo de tests en STATE.md (B-02)"
```

---

# TANDA 1 — Sesión y superficie HTTP

No toca el sync. Se puede hacer entera sin resolver los insumos bloqueantes.

### Tarea 1.1: S-02 — Revalidar el rol en cada emisión de token y acotar la sesión

**Archivos:**
- Modificar: `lib/auth/index.ts:36`
- Modificar: `lib/auth/config.ts:11`
- Modificar: `STATE.md:12` y `STATE.md:66`

**Interfaces:**
- Produce: nada nuevo. Cambia el momento en que se consulta `users`, no la forma del token.

- [ ] **Paso 1: Quitar la condición del callback `jwt`**

En `lib/auth/index.ts`, reemplazar el bloque condicional por una consulta incondicional:

```ts
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email)?.toLowerCase().trim();
      if (!email) return token;

      // Se consulta en CADA emision de token, no solo al iniciar sesion. Con estrategia
      // JWT eso es una consulta por indice unico sobre una tabla de <10 filas cada vez
      // que una ruta Node llama a auth(). Es el precio de que `usuarios -- quitar` surta
      // efecto de inmediato, y a este tamano de equipo es despreciable.
      // ponytail: si el equipo crece, el paso siguiente es `sessionVersion int` en users,
      // comparado en el callback `session`, que revoca sin consultar en cada refresco.
      const registro = await buscarUsuario(email);
      if (!registro || !registro.activo) {
        return { ...token, usuarioId: undefined, rol: undefined, closerId: undefined };
      }
      token.usuarioId = registro.id;
      token.rol = esRolValido(registro.rol) ? registro.rol : "closer";
      token.closerId = registro.closerId;

      return token;
    },
```

Ojo: el parámetro `trigger` deja de usarse. Sacarlo de la firma o el lint se queja.

- [ ] **Paso 2: Acotar la vida de la sesión en `lib/auth/config.ts`**

```ts
  // 8 horas = una jornada. Sin esto rige el default de Auth.js, que son 30 dias.
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
```

- [ ] **Paso 3: Corregir las dos frases falsas de `STATE.md`**

- Línea 12: *"callback `jwt` que revalida rol contra la DB al iniciar sesion y en `update`"* →
  **"callback `jwt` que revalida rol contra la DB en cada emision de token"**.
- Línea 66: *"El rol se revalida contra la DB en cada emision de token"* → ahora sí es cierta,
  dejarla, y agregarle **"; la sesion dura 8 horas"**.

- [ ] **Paso 4: Verificar**

```bash
npm test && npm run typecheck
```

Esperado: pasan. Ningún test existente mockea el `trigger`, así que no debería romperse nada.

- [ ] **Paso 5: Commit**

```bash
git add lib/auth/index.ts lib/auth/config.ts STATE.md
git commit -m "seguridad: revalidar rol en cada emision de token y acotar sesion a 8h (S-02)"
```

### Tarea 1.2: S-03 — Fallar cerrado cuando el token viene vacío

**Archivos:**
- Modificar: `lib/auth/config.ts:21`
- Modificar: `types/next-auth.d.ts:8`
- Test: `tests/roles.test.ts`

**Interfaces:**
- Produce: `Session["user"]["rol"]` pasa de `Rol` a `Rol | null`. Cualquier código que lea
  `session.user.rol` tiene que tolerar `null`. `puedeAcceder` ya lo hace (`roles.ts:33`).

- [ ] **Paso 1: Escribir el test que falla**

En `tests/roles.test.ts`, agregar:

```ts
describe("un token vaciado no se convierte en closer", () => {
  it("puedeAcceder rechaza el rol nulo en rutas de closer", () => {
    expect(puedeAcceder(null, ["closer"])).toBe(false);
  });
  it("puedeAcceder rechaza el rol nulo en rutas de gerente", () => {
    expect(puedeAcceder(null, ["gerente"])).toBe(false);
  });
});
```

- [ ] **Paso 2: Correr y ver que pasa**

```bash
npm test -- roles
```

Esperado: **pasan ya**, porque `puedeAcceder` devuelve `false` con cualquier valor falsy. El test
existe para fijar la garantía, no para descubrirla. El defecto real está en `config.ts`, que nunca
le entrega `null` a esta función porque lo traduce a `"closer"` antes.

- [ ] **Paso 3: Cambiar el callback `session`**

```ts
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.usuarioId ?? "";
        // Un token sin rol NO es un closer. Es nadie. La app no tiene herencia de
        // roles y un rol ausente no puede degradar al rol menor.
        session.user.rol = esRolValido(token.rol) ? token.rol : null;
        session.user.closerId = token.closerId ?? null;
      }
      return session;
    },
```

- [ ] **Paso 4: Ajustar el tipo**

En `types/next-auth.d.ts`, dentro de `interface Session`:

```ts
      rol: Rol | null;
```

- [ ] **Paso 5: Verificar**

```bash
npm run typecheck && npm test
```

Esperado: `typecheck` puede señalar lugares que asumían `rol` no nulo. Cada uno se arregla
verificando el `id` primero, que es lo que ya hacen `proxy.ts:26` y `requireSession()`.

- [ ] **Paso 6: Commit**

```bash
git add lib/auth/config.ts types/next-auth.d.ts tests/roles.test.ts
git commit -m "seguridad: un token vaciado deja rol nulo, no closer (S-03)"
```

### Tarea 1.3: S-04 + B-04 + F-10 — Un solo lugar que decide qué sale al cliente

**Archivos:**
- Crear: `lib/errors.ts`
- Modificar: `lib/auth/roles.ts:10-25`
- Modificar: `lib/sheets/mapeo.ts:25`
- Modificar: `lib/auth/guards.ts:46`
- Modificar: `app/api/sync/[programa]/route.ts:24-30`
- Test: `tests/errores.test.ts` (nuevo)

**Interfaces:**
- Produce: `class ErrorDeApp extends Error { readonly status: number }` en `lib/errors.ts`.
  `AuthorizationError` (403), `AuthenticationError` (401) y `MapeoInvalidoError` (422) la extienden.
  `respuestaDeError(error: unknown): Response` deja de mirar la forma del error y mira su tipo.

**Por qué así y no como dice el informe:** el informe propone que `respuestaDeError` importe
`MapeoInvalidoError`. Eso haría que `lib/auth/` dependa de `lib/sheets/`, que es una capa que no le
corresponde. Una clase base en `lib/errors.ts` da el mismo resultado sin invertir la dependencia, y
deja el lugar donde en la Tarea 3.4 entra el error de zod con su 400.

- [ ] **Paso 1: Escribir el test que falla**

Crear `tests/errores.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { respuestaDeError } from "@/lib/auth/guards";
import { AuthorizationError } from "@/lib/auth/roles";
import { MapeoInvalidoError } from "@/lib/sheets/mapeo";

describe("respuestaDeError", () => {
  it("traduce un error de la app a su status y deja pasar el mensaje", async () => {
    const res = respuestaDeError(new AuthorizationError("solo gerentes"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "solo gerentes" });
  });

  it("traduce el mapeo invalido a 422 con su mensaje, que es accionable", async () => {
    const res = respuestaDeError(new MapeoInvalidoError("estado", ["estado"], ["Correo"]));
    expect(res.status).toBe(422);
    expect((await res.json()).error).toContain("estado");
  });

  it("no deja salir el mensaje de un error interno", async () => {
    const res = respuestaDeError(new Error("connect ECONNREFUSED ep-xyz.neon.tech:5432"));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "Error interno." });
  });
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- errores
```

Esperado: FALLA en el caso del 422, con `expected 500 to be 422`. Hoy `respuestaDeError` no conoce
`MapeoInvalidoError` y lo trata como error no controlado.

- [ ] **Paso 3: Crear la clase base**

`lib/errors.ts`:

```ts
/**
 * Errores que la app sabe traducir a HTTP. Todo lo que NO extienda esta clase se
 * considera un fallo no controlado: se registra en el servidor y al cliente le llega
 * "Error interno." y nada mas.
 *
 * Vive fuera de lib/auth y de lib/sheets a proposito: las dos capas la necesitan y
 * ninguna debe depender de la otra.
 */
export class ErrorDeApp extends Error {
  constructor(mensaje: string, readonly status: number) {
    super(mensaje);
    this.name = new.target.name;
  }
}
```

- [ ] **Paso 4: Hacer que los tres errores la extiendan**

En `lib/auth/roles.ts`:

```ts
import { ErrorDeApp } from "@/lib/errors";

/** Error de autorizacion. Se traduce a 403. */
export class AuthorizationError extends ErrorDeApp {
  constructor(mensaje = "No tienes permiso para ver esto.") {
    super(mensaje, 403);
  }
}

/** Error de autenticacion. Se traduce a 401. */
export class AuthenticationError extends ErrorDeApp {
  constructor(mensaje = "Necesitas iniciar sesion.") {
    super(mensaje, 401);
  }
}
```

En `lib/sheets/mapeo.ts`, que `MapeoInvalidoError` extienda `ErrorDeApp` y pase `422` al `super`,
conservando el mensaje que ya arma con los encabezados reales.

- [ ] **Paso 5: Simplificar `respuestaDeError`**

En `lib/auth/guards.ts`:

```ts
export function respuestaDeError(error: unknown): Response {
  if (error instanceof ErrorDeApp) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("[error no controlado]", error);
  return Response.json({ error: "Error interno." }, { status: 500 });
}
```

- [ ] **Paso 6: Borrar la rama de 422 del endpoint de sync**

En `app/api/sync/[programa]/route.ts`, el `catch` entero queda:

```ts
  } catch (error) {
    return respuestaDeError(error);
  }
```

Se borran las cinco líneas de la rama `!("status" in error)`. **F-10 se cierra solo con esto:**
`components/boton-sincronizar.tsx` no se toca, porque ahora el servidor ya no le manda nada crudo.

- [ ] **Paso 7: Verificar**

```bash
npm test && npm run typecheck
```

Esperado: pasan los tres tests nuevos y los de `guards.test.ts`, que ya ejercitan 401 y 403 sobre
los handlers reales.

- [ ] **Paso 8: Commit**

```bash
git add lib/errors.ts lib/auth/roles.ts lib/auth/guards.ts lib/sheets/mapeo.ts \
        "app/api/sync/[programa]/route.ts" tests/errores.test.ts
git commit -m "seguridad: un solo traductor de errores a HTTP; el endpoint de sync deja de filtrar internos (S-04, B-04, F-10)"
```

### Tarea 1.4: S-07 — El cron compara en tiempo constante y no filtra encabezados

**Archivos:**
- Modificar: `app/api/cron/sync/route.ts:22` y `:35`
- Test: `tests/sync-permisos.test.ts`

**Interfaces:**
- Produce: la respuesta del cron cambia de forma. Pasa de
  `{ ok, resultados: ResultadoSync[], fallos: [{programa, error}] }` a
  `{ ok, programas: number, sincronizados: number, fallidos: number }`.
  El detalle se lee en `sync_runs.errores`, que ya existe para eso.

**Por qué importa la segunda parte:** `/api/cron/sync` está en la lista de rutas públicas de
`proxy.ts:22`. El `e.message` que hoy va en el cuerpo puede ser un `MapeoInvalidoError`, que por
diseño imprime **todos los encabezados reales de la hoja** (`mapeo.ts:32-34`), o sea las preguntas
del formulario de aplicación, por una ruta sin sesión.

- [ ] **Paso 1: Escribir el test que falla**

En `tests/sync-permisos.test.ts`, agregar al bloque del cron:

```ts
it("no devuelve el mensaje de error del sync al cuerpo de la respuesta", async () => {
  vi.mocked(sincronizarPersonas).mockRejectedValue(
    new Error("Encabezados reales: Correo, Cuanto ganas mensualmente, Por que aplicaste"),
  );
  const res = await GET(peticionConSecreto());
  const cuerpo = await res.json();
  expect(JSON.stringify(cuerpo)).not.toContain("Cuanto ganas");
  expect(cuerpo.fallidos).toBe(1);
});
```

(`peticionConSecreto()` es el helper que ya usa ese archivo para armar la `Request` con el header
`Authorization`. Reusarlo, no escribir otro.)

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- sync-permisos
```

Esperado: FALLA en el `not.toContain`. Hoy el mensaje va entero en `fallos[0].error`.

- [ ] **Paso 3: Comparación en tiempo constante**

En `app/api/cron/sync/route.ts`, arriba:

```ts
import { timingSafeEqual } from "node:crypto";

/** Comparacion que no corta en el primer byte distinto. */
function secretoValido(enviado: string | null, esperado: string): boolean {
  if (!enviado) return false;
  const a = Buffer.from(enviado);
  const b = Buffer.from(`Bearer ${esperado}`);
  // timingSafeEqual exige la misma longitud; comparar largos primero delata el largo
  // y nada mas, que no es informacion util para adivinar el secreto.
  return a.length === b.length && timingSafeEqual(a, b);
}
```

y en el handler:

```ts
  if (!secretoValido(req.headers.get("authorization"), esperado)) {
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
```

- [ ] **Paso 4: Devolver conteos, no mensajes**

```ts
  let sincronizados = 0;
  let fallidos = 0;

  for (const p of activos) {
    try {
      await sincronizarPersonas(p.id);
      sincronizados++;
    } catch (e) {
      // Un programa que falla no impide que el otro se sincronice. El detalle queda
      // en sync_runs.errores; aca solo salen conteos, porque esta ruta no tiene sesion.
      fallidos++;
      console.error(`[cron] fallo ${p.slug}`, e);
    }
  }

  return Response.json({ ok: fallidos === 0, programas: activos.length, sincronizados, fallidos });
```

- [ ] **Paso 5: Verificar**

```bash
npm test -- sync-permisos
```

Esperado: PASAN, incluidos los tres que ya existían (sin secreto, secreto equivocado, sin
`CRON_SECRET` configurado).

- [ ] **Paso 6: Commit**

```bash
git add app/api/cron/sync/route.ts tests/sync-permisos.test.ts
git commit -m "seguridad: cron con comparacion en tiempo constante y respuesta sin detalle interno (S-07)"
```

### Tarea 1.5: S-11 — Hacer explícita la garantía del redirect

**Archivos:**
- Modificar: `app/login/page.tsx:23`

**Contexto:** hoy no es explotable, porque el callback `redirect` por defecto de Auth.js descarta
las URLs de otro origen. La protección es real pero **invisible**: no está escrita en ningún lado,
y desaparece el día que alguien agregue un callback `redirect` propio para manejar el `callbackUrl`,
sin tocar esta línea.

- [ ] **Paso 1: Validar el destino**

```ts
  const desdeCrudo = typeof params.desde === "string" ? params.desde : undefined;
  // Solo rutas internas. `//evil.com` es un protocol-relative URL: el navegador lo
  // resuelve como dominio externo, asi que empezar por "/" no alcanza.
  const desde =
    desdeCrudo?.startsWith("/") && !desdeCrudo.startsWith("//") ? desdeCrudo : undefined;
```

El resto del archivo no cambia: `signIn("google", { redirectTo: desde ?? "/" })` ya usa esa variable.

- [ ] **Paso 2: Verificar**

```bash
npm run typecheck && npm run lint
```

- [ ] **Paso 3: Commit**

```bash
git add app/login/page.tsx
git commit -m "seguridad: validar el parametro desde del login como ruta interna (S-11)"
```

### Tarea 1.6: S-05 + S-10 — Cabeceras de seguridad y `AUTH_URL` fijado

**Archivos:**
- Modificar: `next.config.ts`
- Modificar: `.env.example` (descomentar `AUTH_URL`)
- Variables de entorno de Vercel (manual, fuera del repo)

**Alcance deliberado:** se ponen las cuatro cabeceras que no rompen nada. **La CSP completa no va
acá.** Conviene montarla con nonce cuando entre Recharts en la Fase 2, para no tener que aflojarla
después; ponerla ahora y aflojarla en dos semanas es peor que no ponerla.

- [ ] **Paso 1: Agregar el bloque `headers()`**

`next.config.ts`:

```ts
import type { NextConfig } from "next";

const cabecerasDeSeguridad = [
  // Nadie puede meter la app en un iframe: cierra el clickjacking sobre un gerente
  // con sesion abierta, que en la Fase 4 deja de ser teorico (botones que escriben).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  async headers() {
    // ponytail: falta la CSP completa. Se monta con nonce cuando entre Recharts
    // en la Fase 2; ponerla ahora obligaria a aflojarla despues.
    return [{ source: "/:path*", headers: cabecerasDeSeguridad }];
  },
};

export default nextConfig;
```

- [ ] **Paso 2: Fijar `AUTH_URL`**

Descomentar la línea en `.env.example` y **agregar la variable en Vercel** (Settings → Environment
Variables, solo Production):

```
AUTH_URL=https://retia-metrics.vercel.app
```

Con `trustHost: true`, Auth.js arma las URLs de callback desde el header `Host`. Fijar `AUTH_URL`
cierra la puerta a que un alias de preview o un `X-Forwarded-Host` manipulado dirija el flujo.

- [ ] **Paso 3: Verificar en local**

```bash
npm run build && npm start
```

En otra terminal:

```bash
curl -sI http://localhost:3000/login | grep -i "content-security\|referrer\|nosniff"
```

Esperado: aparecen las tres. `Strict-Transport-Security` puede no aparecer en HTTP local; en Vercel
sí. Y comprobar a mano que el login con Google sigue funcionando: es lo único que estas cabeceras
podrían romper.

- [ ] **Paso 4: Commit**

```bash
git add next.config.ts .env.example
git commit -m "seguridad: cabeceras base y AUTH_URL fijado (S-05, S-10)"
```

### Cierre de la Tanda 1

- [ ] `npm test && npm run typecheck && npm run lint` en verde.
- [ ] Desplegar y verificar a mano: entrar con Google, que un closer siga sin poder abrir
      `/ajustes/fuentes`, y que `npm run usuarios -- quitar <correo>` ahora **sí** saque a la
      persona en el siguiente request (esta es la prueba de que S-02 funciona).
- [ ] Releer `STATE.md` entero y corregir lo que dejó de ser cierto.

---

# TANDA 2 — Corrección del motor de sincronización

**Orden por dependencia, no por severidad.** Las cuatro primeras tareas son cambios en funciones
puras, baratas y con test inmediato. La 2.5 es el refactor que hace testeables a las que siguen.
Y **la re-sincronización va una sola vez, al final** (Tarea 2.9): F-05 y F-01 la necesitan las dos,
y correrla dos veces es tiempo perdido.

> **Insumos bloqueantes:** la Tarea 2.7 no arranca sin el mapeo de valores de `Estado` acordado con
> Michael ni sin la decisión sobre `agenda`. Las tareas 2.1 a 2.6 no dependen de eso.

### Tarea 2.1: F-02 — Una fila sin fecha ya no se trata como la más reciente

**Archivos:**
- Modificar: `lib/sheets/dedup.ts:112-113`
- Test: `tests/dedup.test.ts`

- [ ] **Paso 1: Escribir el test que falla**

En `tests/dedup.test.ts`, dentro del `describe` del dedup:

```ts
it("una fila sin fecha parseable no pisa lo que ya se sabia", () => {
  const { personas } = deduplicarPorCorreo([
    { emailNormalizado: "a@x.com", fechaAplicacion: "1/8/2026", telefono: "300111", cargo: "Gerente" },
    { emailNormalizado: "a@x.com", fechaAplicacion: "", telefono: "999999", cargo: "Otro" },
  ]);
  expect(personas[0].telefono).toBe("300111");
  expect(personas[0].cargo).toBe("Gerente");
});

it("pero si rellena un hueco que estaba vacio", () => {
  const { personas } = deduplicarPorCorreo([
    { emailNormalizado: "a@x.com", fechaAplicacion: "1/8/2026", telefono: "300111" },
    { emailNormalizado: "a@x.com", fechaAplicacion: "", cargo: "Analista" },
  ]);
  expect(personas[0].telefono).toBe("300111");
  expect(personas[0].cargo).toBe("Analista");
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- dedup
```

Esperado: FALLA el primero con `expected '999999' to be '300111'`. El segundo pasa ya (la rama
`existente[c] === null` cubre el hueco), y está para que el arreglo no lo rompa.

- [ ] **Paso 3: Invertir el default**

```ts
    // Sin fecha parseable NO se asume que la fila es la mas reciente: solo rellena
    // huecos. Al reves, una celda de fecha en blanco pisaba datos buenos en silencio.
    const esMasReciente =
      fecha != null &&
      (existente.fechaUltimaAplicacion == null || fecha >= existente.fechaUltimaAplicacion);
```

- [ ] **Paso 4: Correr y ver que pasa**

```bash
npm test -- dedup
```

Esperado: PASAN los dos nuevos y los que ya estaban, incluido el del ratio real de Tactical
Investor (2.954 filas → 1.825 personas). **Si ese cambia de número, el arreglo tiene un efecto que
no previmos** y hay que entenderlo antes de seguir.

- [ ] **Paso 5: Commit**

```bash
git add lib/sheets/dedup.ts tests/dedup.test.ts
git commit -m "sync: una fila sin fecha solo rellena huecos, no sobrescribe (F-02)"
```

### Tarea 2.2: F-05 — Fechas con desplazamiento explícito, no el del proceso

**Archivos:**
- Modificar: `lib/sheets/mapeo.ts:102-125`
- Test: `tests/dedup.test.ts` (el bloque `describe("parsearFecha")`)

**El defecto:** `new Date(Number(a), Number(mes)-1, ...)` interpreta los componentes en la zona del
proceso. En la máquina de Michael es UTC-5; en una función de Vercel es UTC. La misma fila produce
dos instantes distintos según dónde corra el sync, sobre una columna `timestamptz`. Para las filas
cercanas a medianoche eso es **un día hábil de diferencia**, y `PROJECT.md` regla 3 dice que el
ritmo por día hábil es una de las métricas centrales.

**Agravante:** `CAMPOS_COMPARABLES` no incluye las fechas, así que si la persona ya existe y lo
único que difiere es el instante, `compararCampos` da cero diffs y no queda ningún registro de que
pasó.

- [ ] **Paso 1: Reescribir los tests de fecha para que no dependan de la zona del que los corre**

Los tests actuales usan `f.getDate()` y `f.getMonth()`, que son getters **locales**: pasan o fallan
según la máquina. Reemplazar ese `describe` entero por:

```ts
describe("parsearFecha", () => {
  it("lee el formato colombiano d/m/yyyy en hora de Colombia, no m/d", () => {
    // 7 de agosto 14:30 en Bogota = 19:30 UTC
    expect(parsearFecha("7/8/2026 14:30:00")!.toISOString()).toBe("2026-08-07T19:30:00.000Z");
  });
  it("distingue dias que serian ambiguos", () => {
    expect(parsearFecha("3/12/2026")!.toISOString()).toBe("2026-12-03T05:00:00.000Z");
  });
  it("no depende de la zona horaria del proceso", () => {
    // Este es el hallazgo F-05: el mismo texto tiene que dar el mismo instante
    // corra donde corra, porque la columna destino es timestamptz.
    expect(parsearFecha("12/8/2026 19:30:00")!.toISOString()).toBe("2026-08-13T00:30:00.000Z");
  });
  it("acepta ISO", () => {
    expect(parsearFecha("2026-08-19")!.getUTCFullYear()).toBe(2026);
  });
  it("devuelve null en vez de una fecha inventada", () => {
    expect(parsearFecha("")).toBeNull();
    expect(parsearFecha("no es fecha")).toBeNull();
  });
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
TZ=UTC npm test -- dedup
```

Esperado: FALLAN los tres primeros. Correrlo con `TZ=UTC` reproduce el entorno de Vercel, que es
exactamente el escenario del hallazgo.

- [ ] **Paso 3: Fijar el desplazamiento**

```ts
export function parsearFecha(v: unknown): Date | null {
  const s = String(v ?? "").trim();
  if (!s) return null;

  const m = s.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ ,]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/,
  );
  if (m) {
    const [, d, mes, a, h = "0", min = "0", seg = "0"] = m;
    const p2 = (n: string) => n.padStart(2, "0");
    // Colombia no tiene horario de verano: el desplazamiento es -05:00 siempre.
    // Fijarlo explicitamente es lo unico que hace que el sync de la maquina de
    // Michael (UTC-5) y el del cron de Vercel (UTC) guarden el mismo instante.
    const f = new Date(
      `${a}-${p2(mes)}-${p2(d)}T${p2(h)}:${p2(min)}:${p2(seg)}-05:00`,
    );
    return Number.isNaN(f.getTime()) ? null : f;
  }

  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const f = new Date(s);
    return Number.isNaN(f.getTime()) ? null : f;
  }

  return null;
}
```

- [ ] **Paso 4: Correr en las dos zonas**

```bash
TZ=UTC npm test -- dedup && TZ=America/Bogota npm test -- dedup
```

Esperado: PASAN las dos veces con el mismo resultado. Esa es la garantía del hallazgo.

- [ ] **Paso 5: Commit**

```bash
git add lib/sheets/mapeo.ts tests/dedup.test.ts
git commit -m "sync: fechas con desplazamiento -05:00 explicito, no el del proceso (F-05)"
```

> **Nota:** las fechas ya guardadas siguen mezcladas. Se corrigen en la re-sincronización de la
> Tarea 2.9, no acá.

### Tarea 2.3: F-09 — Coincidencia exacta antes que parcial, y avisar si hay ambigüedad

**Archivos:**
- Modificar: `lib/sheets/mapeo.ts:53`
- Test: `tests/dedup.test.ts` (el bloque de `resolverColumnas`)

**El defecto:** gana el primer encabezado que *contenga* el patrón. La mayoría son largos y
específicos, pero `estado: "estado"` es una sola palabra: con "Estado" y "Estado de la llamada" en
la misma hoja, el mapeo agarra el que esté más a la izquierda y nadie se entera. Justo la columna
que la Tarea 2.7 empieza a usar.

- [ ] **Paso 1: Escribir el test que falla**

```ts
it("prefiere el encabezado exacto sobre el que solo contiene el patron", () => {
  const i = resolverColumnas(
    ["Estado de la llamada", "Correo electronico", "Estado"],
    { estado: "estado", emailNormalizado: "correo electronico" },
  );
  expect(i.estado).toBe(2);
});
```

- [ ] **Paso 2: Correr y ver que falla**

```bash
npm test -- dedup
```

Esperado: FALLA con `expected 0 to be 2`.

- [ ] **Paso 3: Buscar exacto primero**

```ts
  for (const [campo, patron] of Object.entries(mapeo)) {
    const buscados = (Array.isArray(patron) ? patron : [patron]).map(normalizarTexto);

    // Exacto primero. Sin esto, "estado" agarra "estado de la llamada" solo por
    // estar mas a la izquierda, y el error es invisible.
    let i = normalizados.findIndex((h) => h !== "" && buscados.includes(h));
    if (i < 0) i = normalizados.findIndex((h) => h !== "" && buscados.some((b) => h.includes(b)));

    if (i >= 0) indices[campo] = i;
    else if (obligatorios.includes(campo)) {
      throw new MapeoInvalidoError(campo, buscados, encabezados);
    }
  }
```

- [ ] **Paso 4: Correr y ver que pasa**

```bash
npm test -- dedup
```

Esperado: PASAN el nuevo y los tres que ya cubrían `resolverColumnas`, incluido el que verifica que
el mismo mapeo resuelve los dos programas.

- [ ] **Paso 5: Commit**

```bash
git add lib/sheets/mapeo.ts tests/dedup.test.ts
git commit -m "sync: resolver columnas por coincidencia exacta antes que parcial (F-09)"
```

### Tarea 2.4: F-08 — Escapar el apóstrofo en el nombre de la pestaña

**Archivos:**
- Modificar: `lib/sheets/leer.ts:13`

**Por qué ahora y no cuando pase:** `sources.tab` viene de la base, y el plan de la Fase 1 pedía
poder editar el mapeo desde la UI (`STATE.md` lo declara como desviación consciente). El día que
esa pantalla exista, este campo pasa a ser entrada de usuario. Es una línea.

- [ ] **Paso 1: Escapar**

```ts
  // Sheets escapa un apostrofo literal dentro del nombre de hoja duplicandolo.
  const tabEscapada = tab.replace(/'/g, "''");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: `'${tabEscapada}'!${rango}`,
    valueRenderOption: "FORMATTED_VALUE",
  });
```

- [ ] **Paso 2: Verificar**

```bash
npm run typecheck && npm test
```

- [ ] **Paso 3: Commit**

```bash
git add lib/sheets/leer.ts
git commit -m "sync: escapar el apostrofo en el nombre de la pestana (F-08)"
```

### Tarea 2.5: B-01 — Separar la decisión de la escritura

**Archivos:**
- Crear: `lib/sheets/planificar.ts`
- Modificar: `lib/sheets/sync.ts:126-170`
- Test: `tests/planificar.test.ts` (nuevo)

**Por qué esta tarea va antes de F-03 y F-04, y no después como sugiere el informe:**
`sincronizarPersonas()` es la única función que escribe en la base y no tiene un solo test. Los
cambios de las tareas 2.6 y 2.7 son los más riesgosos del plan y caen justo ahí. Separar primero la
parte pura convierte esos cambios en tests de tres líneas; hacerlo después significa cambiar código
sin red. El repo ya demostró que sabe hacer esta separación: `dedup.ts` está fuera de `sync.ts` por
exactamente la misma razón.

**Interfaces:**
- Produce:

```ts
export type PlanDeSync = {
  aInsertar: (typeof people.$inferInsert)[];
  aActualizar: { id: string; registro: typeof people.$inferInsert }[];
  cambios: (typeof changeLog.$inferInsert)[];
};

export function planificarSync(
  personasDeHoja: PersonaDeducida[],
  existentes: Map<string, typeof people.$inferSelect>,
  programId: string,
  syncRunId: string,
): PlanDeSync;
```

- Consume: `PersonaDeducida` de `./dedup`, los tipos de `@/lib/db/schema`. **Ninguna llamada a
  `db`.** Esa es la condición que hace que se pueda testear.

- [ ] **Paso 1: Mover `aRegistro` y `compararCampos` a `planificar.ts`**

Se mueven tal cual, sin cambiarles nada. `CAMPOS_COMPARABLES` se va con ellas. Exportarlas para
poder testearlas.

- [ ] **Paso 2: Escribir `planificarSync` con el mismo cuerpo del bucle actual**

Es el bucle de `sync.ts:129-160`, con dos cambios mecánicos: en vez de `await db.update(...)`
empuja a `aActualizar`, y en vez de `resultado.nuevas++` deja que el llamador cuente sobre los
largos de los arreglos.

- [ ] **Paso 3: Escribir los tests**

Crear `tests/planificar.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { planificarSync } from "@/lib/sheets/planificar";
import type { PersonaDeducida } from "@/lib/sheets/dedup";

const PROGRAMA = "11111111-1111-1111-1111-111111111111";
const CORRIDA = "22222222-2222-2222-2222-222222222222";

function persona(over: Partial<PersonaDeducida> = {}): PersonaDeducida {
  return {
    emailNormalizado: "a@x.com", nombre: "Ana", telefono: "300111", cargo: null,
    ingresoDeclarado: null, urgencia: null, porQueAplico: null,
    utmSource: null, utmMedium: null, utmCampaign: null, estado: null,
    fechaPrimeraAplicacion: null, fechaUltimaAplicacion: null,
    numAplicaciones: 1, raw: {}, ...over,
  };
}

describe("planificarSync", () => {
  it("una persona que no esta en la base va a aInsertar", () => {
    const plan = planificarSync([persona()], new Map(), PROGRAMA, CORRIDA);
    expect(plan.aInsertar).toHaveLength(1);
    expect(plan.aActualizar).toHaveLength(0);
    expect(plan.cambios).toHaveLength(0);
  });

  it("un sync sin novedades no escribe nada", () => {
    const existentes = new Map([["a@x.com", {
      id: "33333333-3333-3333-3333-333333333333",
      nombre: "Ana", telefono: "300111", numAplicaciones: 1,
    } as never]]);
    const plan = planificarSync([persona()], existentes, PROGRAMA, CORRIDA);
    expect(plan.aInsertar).toHaveLength(0);
    expect(plan.aActualizar).toHaveLength(0);
    expect(plan.cambios).toHaveLength(0);
  });

  it("un campo que cambia genera exactamente una fila de bitacora", () => {
    const existentes = new Map([["a@x.com", {
      id: "33333333-3333-3333-3333-333333333333",
      nombre: "Ana", telefono: "300000", numAplicaciones: 1,
    } as never]]);
    const plan = planificarSync([persona({ telefono: "300111" })], existentes, PROGRAMA, CORRIDA);
    expect(plan.aActualizar).toHaveLength(1);
    expect(plan.cambios).toHaveLength(1);
    expect(plan.cambios[0].campo).toBe("telefono");
    expect(plan.cambios[0].valorAnterior).toBe("300000");
    expect(plan.cambios[0].valorNuevo).toBe("300111");
  });
});
```

- [ ] **Paso 4: Correr**

```bash
npm test -- planificar
```

Esperado: PASAN los tres. Si no, el movimiento del paso 1 cambió algo sin querer.

- [ ] **Paso 5: Dejar `sincronizarPersonas` como envoltorio**

El bucle de `sync.ts` se reemplaza por:

```ts
    const plan = planificarSync(personas, existentes, programId, corrida.id);
    resultado.nuevas = plan.aInsertar.length;
    resultado.actualizadas = plan.aActualizar.length;
```

seguido de las escrituras, que en la Tarea 2.6 pasan a ser una sola.

- [ ] **Paso 6: Verificar que el sync real sigue haciendo lo mismo**

```bash
npm test && npm run typecheck && npm run sync
```

Esperado: `npm run sync` termina y reporta **0 nuevas, 0 actualizadas** contra la base actual (nada
cambió en las hojas). Si reporta actualizaciones, el refactor alteró el comportamiento.

- [ ] **Paso 7: Commit**

```bash
git add lib/sheets/planificar.ts lib/sheets/sync.ts tests/planificar.test.ts
git commit -m "sync: separar planificarSync puro del envoltorio de E/S, con tests (B-01)"
```

### Tarea 2.6: F-03 + F-04 — Upsert por lotes y un solo sync a la vez por programa

**Archivos:**
- Modificar: `lib/sheets/sync.ts:126-170`
- Test: `tests/planificar.test.ts`

**Los dos defectos son el mismo hueco visto de dos lados.** El `insert` pelado contra un índice
único `(program_id, email_normalizado)` revienta si dos corridas se solapan, y el cron corre cada
15 minutos con `maxDuration` de 300 segundos y un botón "Sincronizar ahora" que dispara otra cuando
alguien quiera. El `update` fila por fila es el mismo error que `STATE.md` cuenta que ya se aprendió
para el insert (161 segundos → lotes de 200): el camino de actualización nunca se arregló. El día
que se corrija el mapeo (que es exactamente lo que hace la Tarea 2.7), las ~3.100 personas aparecen
con diff y son ~3.100 viajes HTTP secuenciales.

Y no hay transacción que salve: `neon-http` no soporta transacciones de varias sentencias.

- [ ] **Paso 1: Reemplazar insert + update por un upsert por lotes**

```ts
    // Un solo camino de escritura para nuevas y modificadas. El upsert hace que dos
    // corridas solapadas converjan en vez de reventar contra el indice unico, y saca
    // los ~3.100 viajes HTTP que costaria un cambio de mapeo transversal.
    const aEscribir = [...plan.aInsertar, ...plan.aActualizar.map((a) => a.registro)];

    for (let i = 0; i < aEscribir.length; i += 200) {
      await db
        .insert(people)
        .values(aEscribir.slice(i, i + 200))
        .onConflictDoUpdate({
          target: [people.programId, people.emailNormalizado],
          set: {
            nombre: sql`excluded.nombre`,
            telefono: sql`excluded.telefono`,
            cargo: sql`excluded.cargo`,
            ingresoDeclarado: sql`excluded.ingreso_declarado`,
            urgencia: sql`excluded.urgencia`,
            porQueAplico: sql`excluded.por_que_aplico`,
            utmSource: sql`excluded.utm_source`,
            utmMedium: sql`excluded.utm_medium`,
            utmCampaign: sql`excluded.utm_campaign`,
            fechaPrimeraAplicacion: sql`excluded.fecha_primera_aplicacion`,
            fechaUltimaAplicacion: sql`excluded.fecha_ultima_aplicacion`,
            numAplicaciones: sql`excluded.num_aplicaciones`,
            raw: sql`excluded.raw`,
            updatedAt: new Date(),
          },
        });
    }
```

`sql` se importa de `drizzle-orm`. **Importante:** en la Tarea 2.7 hay que acordarse de agregar
`estado` a este `set`, o el sync escribirá el estado solo en las filas nuevas.

- [ ] **Paso 2: Candado por programa**

Antes de crear la corrida, en `sincronizarPersonas`:

```ts
  // Un solo sync a la vez por programa. Sin esto, el cron (cada 15 min) y el boton
  // de /ajustes/fuentes pueden solaparse sobre la misma tabla.
  const CORRIDA_COLGADA_MS = 10 * 60 * 1000; // maxDuration es 300s; el doble da margen
  const [enCurso] = await db
    .select()
    .from(syncRuns)
    .where(and(eq(syncRuns.programId, programId), eq(syncRuns.estado, "corriendo")))
    .orderBy(desc(syncRuns.iniciado))
    .limit(1);

  if (enCurso && Date.now() - enCurso.iniciado.getTime() < CORRIDA_COLGADA_MS) {
    throw new SyncEnCursoError(programa.slug);
  }
```

`SyncEnCursoError` va en `lib/errors.ts` extendiendo `ErrorDeApp` con status **409**, y así el
botón de la UI muestra "ya hay una sincronización en curso" en vez de un error interno. Es el
retorno de la Tarea 1.3.

> Este `where` usa `syncRuns.programId`, que **todavía no existe**: lo crea la Tarea 2.8. Si se
> ejecuta 2.6 antes que 2.8, usar `sourceId` provisionalmente y volver acá. Recomendado: hacer 2.8
> primero si se va a paralelizar.

- [ ] **Paso 3: Test del candado**

```ts
it("una corrida reciente en estado corriendo bloquea otra del mismo programa", async () => {
  // con el mock de db devolviendo una corrida iniciada hace 1 minuto
  await expect(sincronizarPersonas(PROGRAMA)).rejects.toThrow(SyncEnCursoError);
});

it("una corrida colgada de hace mas de 10 minutos no bloquea", async () => {
  // con el mock devolviendo una corrida iniciada hace 30 minutos
  await expect(sincronizarPersonas(PROGRAMA)).resolves.toBeDefined();
});
```

- [ ] **Paso 4: Verificar**

```bash
npm test && npm run typecheck
npm run sync              # una vez: 0 nuevas, 0 actualizadas
npm run sync & npm run sync; wait   # dos a la vez: la segunda dice "ya hay una en curso"
```

Esperado: la segunda corrida sale con el error de 409 y **la base queda intacta**, no a medias.

- [ ] **Paso 5: Commit**

```bash
git add lib/sheets/sync.ts lib/errors.ts tests/planificar.test.ts
git commit -m "sync: upsert por lotes y candado por programa (F-03, F-04)"
```

### Tarea 2.7: F-01 — Que `estado` llegue a la base

**Bloqueada por los dos primeros insumos.** No arrancar sin el mapeo de valores acordado.

**Archivos:**
- Modificar: `lib/db/schema.ts` (columna `agenda`, si se decide guardarla)
- Crear: migración en `drizzle/`
- Modificar: `lib/sheets/dedup.ts` (`PersonaDeducida`, `CAMPOS_TEXTO`)
- Modificar: `lib/sheets/planificar.ts` (`aRegistro`, `CAMPOS_COMPARABLES`, el `set` del upsert)
- Modificar: `lib/sheets/mapeo.ts` (traductor de texto a enum)
- Test: `tests/planificar.test.ts`, `tests/dedup.test.ts`

**Recordatorio de la auditoría (A-1):** para `estado` alcanza con tocar `aRegistro`. Para `agenda`
no: no está en `PersonaDeducida`, no está en `CAMPOS_TEXTO` y **no existe la columna en `people`**.
Son cuatro capas, no una.

- [ ] **Paso 1: Sacar los valores reales**

```bash
npm run inspeccionar
```

Listar los valores distintos de la columna `Estado` en las dos hojas y llevarlos a Michael. El
resultado es una tabla texto → enum. **Sin esa tabla acordada, esta tarea no sigue.** El mismo
criterio que el repo ya aplica a los encabezados vale para los valores: no se adivinan.

- [ ] **Paso 2: Escribir el traductor con la tabla acordada**

En `lib/sheets/mapeo.ts`:

```ts
/**
 * Traduce el texto de la columna Estado al enum. La tabla la acordamos con Michael
 * el <fecha> sobre los valores reales de las dos hojas (F-01).
 * Un valor desconocido NO se adivina: cae a null y el sync lo reporta como advertencia.
 */
const ESTADOS: Record<string, EstadoPersona> = {
  // ⚠️ UNICO HUECO DELIBERADO DE ESTE PLAN. Se llena con la salida de
  // `npm run inspeccionar` (paso 1) y la decision de Michael. No se puede
  // escribir antes: los valores reales de la columna solo estan en las hojas.
};

export function parsearEstado(v: unknown): EstadoPersona | null {
  const s = normalizarTexto(String(v ?? ""));
  return s ? (ESTADOS[s] ?? null) : null;
}
```

- [ ] **Paso 3: Escribir el test que falla**

```ts
it("una persona con estado en la hoja no queda en el default del esquema", () => {
  const plan = planificarSync([persona({ estado: "Invitado" })], new Map(), PROGRAMA, CORRIDA);
  expect(plan.aInsertar[0].estado).toBe("invitado");
});

it("un estado desconocido no se adivina: queda nulo", () => {
  expect(parsearEstado("Vino a la reunion pero no cerro")).toBeNull();
});
```

- [ ] **Paso 4: Correr y ver que falla**

```bash
npm test -- planificar
```

Esperado: FALLA con `expected undefined to be 'invitado'`.

- [ ] **Paso 5: Migración, si se decidió guardar `agenda`**

```bash
npm run db:generate && npm run db:migrate
```

Revisar el SQL generado **antes** de aplicarlo. Si la decisión fue no guardar `agenda`, saltarse
este paso y en su lugar **quitar `agenda` y `capacidadInvertir` de `MAPEO_FORMULARIO`**: que estén
mapeados y muertos es lo que confunde a quien lea el código.

- [ ] **Paso 6: Conectar las capas**

- `aRegistro`: agregar `estado: parsearEstado(p.estado) ?? "cola_setteo"`.
- `CAMPOS_COMPARABLES`: agregar `"estado"`. Es la señal más útil de la bitácora, dice cuándo se
  movió el embudo.
- El `set` del upsert de la Tarea 2.6: agregar `estado: sql\`excluded.estado\``.
- Si se guarda `agenda`: agregarla a `PersonaDeducida`, a `CAMPOS_TEXTO` y a `aRegistro`.

- [ ] **Paso 7: Verificar**

```bash
npm test && npm run typecheck
```

- [ ] **Paso 8: Commit**

```bash
git add lib/db/schema.ts drizzle/ lib/sheets/ tests/
git commit -m "sync: mapear estado de la hoja al enum y registrarlo en la bitacora (F-01)"
```

### Tarea 2.8: F-07 — La corrida es del programa, no de la primera fuente

**Archivos:**
- Modificar: `lib/db/schema.ts` (tabla `sync_runs`)
- Crear: migración en `drizzle/`
- Modificar: `lib/sheets/sync.ts:58-61` y `:171-181`
- Modificar: la pantalla `/ajustes/fuentes`

**El defecto:** la corrida cubre **todas** las fuentes del programa (decisión de diseño correcta y
bien argumentada en el comentario de cabecera de `sync.ts`), pero se cuelga de `fuentes[0]`, que es
el primer elemento tal como vino de la base, sin ordenar. Para Comunicarte, que tiene dos
formularios, la pantalla muestra el historial atribuido a la fuente equivocada.

Y al cerrar se escriben tres contadores. Quedan sin persistir `registrosNuevos` (la columna existe
y nunca se escribe), `personasEnHoja` y `sinCorreo`. `sinCorreo` es justo la señal de calidad de
datos que uno querría ver: cuántas filas del formulario no traían correo y por lo tanto no son
nadie.

- [ ] **Paso 1: Cambiar el esquema**

En `sync_runs`: `sourceId` → `programId` (referencia a `programs`, `onDelete: "cascade"`), agregar
`fuentesLeidas: jsonb("fuentes_leidas")`, `personasEnHoja: integer(...)` y
`sinCorreo: integer(...)`. Cambiar el índice `sync_runs_fuente_idx` por
`sync_runs_programa_idx` sobre `(programId, iniciado)`.

- [ ] **Paso 2: Generar y revisar la migración**

```bash
npm run db:generate
```

Leer el SQL. Cambiar una FK sobre una tabla con datos exige decidir qué pasa con las corridas
viejas: lo más simple y honesto es borrarlas (`sync_runs` es historial operativo, no dato de
negocio) y dejarlo escrito en el mensaje del commit.

```bash
npm run db:migrate
```

- [ ] **Paso 3: Escribir los contadores que faltan**

En el `update` final de `sincronizarPersonas`, agregar `personasEnHoja`, `sinCorreo`,
`registrosNuevos` y `fuentesLeidas`.

- [ ] **Paso 4: Mostrar `sinCorreo` en la pantalla**

En `/ajustes/fuentes`, agregar la columna al historial. Es el número que dice si la hoja se está
llenando mal.

- [ ] **Paso 5: Verificar**

```bash
npm test && npm run typecheck && npm run sync
```

Abrir `/ajustes/fuentes` y comprobar que el historial de Comunicarte ya no aparece colgado de un
solo formulario.

- [ ] **Paso 6: Commit**

```bash
git add lib/db/schema.ts drizzle/ lib/sheets/sync.ts app/
git commit -m "sync: la corrida se registra por programa y persiste todos sus contadores (F-07)"
```

### Tarea 2.9: Re-sincronización única y verificación

**Todo lo anterior cambia lo que se escribe. Esta tarea lo aplica a los datos que ya están.**
Va una sola vez, al final: F-05 (zonas horarias mezcladas) y F-01 (estado en el default) necesitan
las dos una re-sincronización, y `STATE.md` dice que la carga en frío tarda 4 segundos.

- [ ] **Paso 1: Respaldo antes de tocar nada**

```bash
# Neon: crear un branch desde production, que es instantaneo y es el rollback
```

- [ ] **Paso 2: Contar el antes**

Anotar: total de personas por programa, cuántas tienen `estado = 'cola_setteo'`, y el rango de
`fechaUltimaAplicacion`.

- [ ] **Paso 3: Re-sincronizar**

```bash
npm run sync
```

- [ ] **Paso 4: Verificar el después**

- [ ] El total de personas por programa **no cambió**. Si cambió, el dedup se movió y hay que
      entender por qué antes de seguir.
- [ ] `estado` ya no es `cola_setteo` para todas: la distribución se parece a la de las hojas.
- [ ] Las fechas están todas en el mismo huso. Cruzar una decena contra la hoja a mano.
- [ ] `change_log` tiene filas de `estado`, que es la señal de que la bitácora del embudo funciona.
- [ ] `/ajustes/fuentes` muestra la corrida con todos los contadores y el `sinCorreo`.

- [ ] **Paso 5: Cierre de la Tanda 2**

- [ ] `npm test && npm run typecheck && npm run lint` en verde.
- [ ] Releer `STATE.md` entero: corregir la línea 43 (dice "hace upsert" y hasta esta tanda no era
      cierto; ahora sí), la línea 80 (dice que `lib/sheets/` está vacía) y el conteo de tests.
- [ ] **La Fase 2 queda desbloqueada.** El embudo ya tiene datos sobre los que calcularse.

---

# TANDA 3 — Endurecimiento y decisiones

Nada de acá bloquea la Fase 2. Se puede hacer en cualquier orden salvo donde se indique.

### Tarea 3.1: B-07 + B-08 + S-08 + S-09 — Los cuatro arreglos de los scripts de shell

**Archivos:** `scripts/configurar-env.sh`, `scripts/rotar-secretos.sh`,
`scripts/cargar-cuenta-servicio.sh`, `package.json`

Van juntos porque tocan los mismos tres archivos y separarlos son tres conflictos.

- [ ] **B-07** · `set -uo pipefail` → `set -euo pipefail` en los tres, y marcar con `|| true` los
      comandos donde el fallo sea aceptable. El caso concreto: `cargar-cuenta-servicio.sh:43` hace
      `cp` de `.env.local` sin verificar que exista, y hoy el script sigue y revienta después en
      python con un error mucho menos claro.
- [ ] **B-08** · en `rotar-secretos.sh:52-53`, `re.sub` con una lambda como reemplazo:
      `re.sub(patron, lambda _: f'AUTH_GOOGLE_SECRET="{google}"', s, flags=re.M)`. El string de
      reemplazo interpreta `\1`, `\n` y demás; hoy funciona porque los secretos son base64 y
      `GOCSPX-`, y el día que uno traiga un backslash el archivo se escribe mutilado sin error.
- [ ] **S-08** · pasar los secretos a python por variable de entorno del proceso hijo, no por
      argumento: `NUEVO="$nuevo" SESION="$auth" python3 - "$ARCHIVO" <<'PY'` y leerlos con
      `os.environ`. Los argumentos son visibles en `ps aux` para cualquier usuario de la máquina.
      El peor caso es `cargar-cuenta-servicio.sh:45`, que pasa la llave privada completa en base64.
- [ ] **S-09** · que cada script deje **un solo** respaldo, con `chmod 600`, y borre los anteriores.
      Agregar `npm run limpiar-respaldos` que los pase por `rm -P` y correrlo al final de cada
      rotación. Hoy los `.env.local.bak-*` se acumulan en claro con los secretos viejos **y**
      nuevos, lo que vacía de sentido la rotación contra quien tenga acceso al disco.
- [ ] Verificar: correr `bash -n` sobre los tres, y `npm run rotar` en una copia de `.env.local`
      para comprobar que sigue funcionando.
- [ ] Commit: `git commit -m "scripts: set -e, secretos por entorno, respaldo unico y re.sub seguro (B-07, B-08, S-08, S-09)"`

### Tarea 3.2: S-13 — Los IDs de las hojas a variables de entorno

**Archivos:** `scripts/seed-datos.ts:12-13`, `.env.example`

- [ ] Mover `SHEET_COMUNICARTE` y `SHEET_TACTICAL` a `SHEET_ID_COMUNICARTE` y `SHEET_ID_TACTICAL`,
      leerlos con la validación ruidosa que el repo ya usa (`if (!x) throw`).
- [ ] Documentarlos en `.env.example` **sin los valores**.
- [ ] Tarea aparte, sin código: revisar con quién están compartidas las dos hojas hoy. El ID no es
      una credencial, pero es la dirección exacta de las dos bases con todos los leads, y el
      permiso de una hoja es una casilla que alguien puede cambiar a "cualquiera con el enlace".
- [ ] Commit: `git commit -m "seguridad: IDs de las hojas por variable de entorno (S-13)"`

### Tarea 3.3: B-05 — Cliente de base de datos perezoso

**Archivos:** `lib/db/index.ts`, `STATE.md`

Fallar ruidosamente es correcto; fallar **en tiempo de importación** es lo que genera el problema.
Hoy cualquier archivo que importe `lib/db`, aunque sea para un tipo, revienta si falta la variable.
Por eso `scripts/load-env.ts` tiene que ser el primer import de todos los scripts, y por eso hay un
párrafo de `STATE.md` explicándolo. Es un requisito de orden de imports sostenido por convención.

- [ ] Reemplazar la constante `db` por un getter perezoso que cree el cliente en el primer query y
      lance ahí, con el mismo mensaje de error.
- [ ] Verificar: `npm test`, `npm run typecheck`, y **quitar `load-env.ts` de la primera línea de un
      script** para comprobar que ya no es obligatorio.
- [ ] Actualizar el párrafo de `STATE.md` que documenta la restricción, que deja de aplicar.
- [ ] Commit: `git commit -m "db: inicializacion perezosa, sin restriccion de orden de imports (B-05)"`

### Tarea 3.4: B-03 — Fijar el patrón de validación con zod

`zod@^4.4.3` está en `dependencies` y no lo importa ningún archivo (verificado sobre `lib`, `app`,
`components`, `scripts` y `types`). Hoy no hay entrada de usuario que validar. Pero la Fase 4 recibe
el formulario de registro de llamadas y la Fase 5 recibe archivos subidos.

- [ ] Un esquema por ruta, parseado en el borde del handler, sobre el endpoint que ya existe.
- [ ] Que `respuestaDeError` traduzca `ZodError` a 400. El lugar ya está preparado por la Tarea 1.3:
      es un `instanceof` más en `lib/auth/guards.ts`.
- [ ] Test: un cuerpo inválido devuelve 400 y no 500.
- [ ] Commit: `git commit -m "validacion: patron de zod en el borde, con 400 en respuestaDeError (B-03)"`

### Tarea 3.5: B-06 + S-06 — Qué se guarda de las personas y por cuánto tiempo

**Es una decisión antes que un cambio de código.** Va junta porque son la misma pregunta desde dos
ángulos: `people.raw` duplica la fila entera del formulario, y `change_log.valorAnterior` /
`valorNuevo` guardan datos de contacto en texto plano con el nombre de la persona al lado.

Hoy no hay exposición activa: ningún endpoint los lee. Pero el "panel de cambios" está en el alcance
de la Fase 2, y estas tres preguntas conviene responderlas antes de que la pantalla exista:

- [ ] **Quién lo ve.** `PROJECT.md` regla 6 dice que un closer no ve datos de otros. La bitácora,
      tal como está, no tiene noción de a qué closer pertenece cada persona.
- [ ] **Qué campos merecen bitácora.** Recomendación: los de estado y conteo, no los de contacto.
      Que cambie el `estado` es señal operativa; que cambie el teléfono es un dato personal más,
      guardado una vez más.
- [ ] **Cuánto se guarda.** Hoy nada purga `change_log` ni `people.raw`. Si alguien ejerce derecho
      de supresión, hay que borrarlo de tres lugares y nadie lo tiene escrito.
- [ ] Con las tres respuestas: guardar en `raw` solo las claves que el mapeo **no** cubre (conserva
      la capacidad de auditar sin volver a Sheets, que es el motivo declarado en el comentario del
      esquema, y deja de duplicar PII), y agregar la política de retención con un job de purga.
- [ ] Escribir las decisiones en `STATE.md`.

### Tarea 3.6: F-06 — La persona que desaparece de la hoja

**Bloqueada por el tercer insumo.** El motor solo inserta y actualiza: si una fila se borra de la
hoja o se mueve a otra pestaña, la persona se queda en la base para siempre y sigue contando en el
denominador de todas las tasas. `PROJECT.md` regla 7 dice que ante conflicto gana Sheets; hoy la app
implementa media regla, porque Sheets gana en lo que cambia pero no en lo que desaparece.

- [ ] Si **nunca se borran filas**: escribirlo en `STATE.md` como supuesto verificado, con fecha y
      con quién lo confirmó. Cero código. Lo que no sirve es que quede sin decidir.
- [ ] Si **sí se borran**: columna `ausenteDesde timestamptz` en `people`, comparar el conjunto de
      correos de la hoja contra el de la base después del dedup, marcar los ausentes (**no
      borrarlos**, se perdería la trazabilidad), excluirlos de las métricas y mostrar el conteo en
      `/ajustes/fuentes`.

### Tarea 3.7: B-10 — Tests de permisos sobre las páginas

`tests/guards.test.ts` y `tests/sync-permisos.test.ts` cubren los route handlers, que es lo más
importante. Pero **ninguna página tiene test**: nada verifica que `/comunicarte` redirija a un
closer ni que `/ajustes/fuentes` lo rechace, y `paginaConRol` es lo único que protege los dashboards
con las cifras de caja y el comparativo entre closers.

- [ ] Un test por grupo de rutas: invocar el componente de página con sesión mockeada y verificar
      que `redirect` se llamó con la ruta esperada. Mismo patrón de `vi.mock` que ya usan los otros.
- [ ] `STATE.md` deja el barrido completo de endpoints para la Fase 7, lo cual es razonable. Las
      páginas merecen adelantarse: son la superficie que más crece en las Fases 2 a 5 y el costo hoy
      son tres tests.
- [ ] Commit: `git commit -m "tests: cobertura de permisos sobre las paginas (B-10)"`

### Tarea 3.8: S-12 — Mutaciones como Server Actions (dejar para la Fase 4)

`POST /api/sync/:programa` cambia estado y no lleva token CSRF. Los Route Handlers de Next, a
diferencia de las Server Actions, no traen protección incorporada; hoy alcanza con que la cookie de
Auth.js sea `SameSite=Lax`.

- [ ] **No hacer nada ahora.** Depender de una capa del navegador está bien mientras lo único que
      hace el endpoint es disparar un sync.
- [ ] **Anotarlo como requisito de entrada de la Fase 4**, cuando el registro de llamadas escriba de
      vuelta en Sheets (`PROJECT.md` regla 7): esas mutaciones nacen como Server Actions, que traen
      la verificación de origen sola.

### Tarea 3.9: S-14 — Separar preview de producción

`STATE.md` ya lo tiene anotado como deuda. El ángulo de seguridad que falta en esa nota: mientras
compartan base, **cualquier deployment de preview tiene escritura sobre los datos reales**, y las
URLs de preview son más fáciles de alcanzar que la de producción.

- [ ] **Antes de abrir la primera rama con PR** (o sea, antes de la próxima vez que alguien haga lo
      que hicimos con la revisión): rama de Neon separada para preview, que se crea por copia en
      segundos.
- [ ] Activar Vercel Deployment Protection sobre los deployments de preview.

### Tarea 3.10: B-02 — Que `STATE.md` deje de mentir por diseño

El problema de fondo no son los cuatro desajustes: es que `AGENTS.md` convierte a `STATE.md` en la
única fuente de verdad de la próxima sesión, así que una afirmación falsa ahí no se corrige, **se
hereda**. Las tandas anteriores ya corrigieron los cuatro. Falta el mecanismo.

- [ ] Agregar al checklist de cierre de fase de `AGENTS.md` un paso explícito: *releer `STATE.md`
      completo y corregir lo que ya no sea cierto, no solo agregar lo nuevo.*
- [ ] Commit: `git commit -m "docs: releer STATE.md completo al cerrar cada fase (B-02)"`

---

## Cobertura: los 33 hallazgos contra las tareas

| Hallazgo | Tarea | Hallazgo | Tarea |
|---|---|---|---|
| S-01 | ✅ hecho (`aa4bdf8` + rotación del 6-sep) | F-01 | 2.7 |
| S-02 | 1.1 | F-02 | 2.1 |
| S-03 | 1.2 | F-03 | 2.6 |
| S-04 | 1.3 | F-04 | 2.6 |
| S-05 | 1.6 | F-05 | 2.2 |
| S-06 | 3.5 | F-06 | 3.6 |
| S-07 | 1.4 | F-07 | 2.8 |
| S-08 | 3.1 | F-08 | 2.4 |
| S-09 | 3.1 | F-09 | 2.3 |
| S-10 | 1.6 | F-10 | 1.3 (se cierra solo) |
| S-11 | 1.5 | B-01 | 2.5 |
| S-12 | 3.8 (Fase 4) | B-02 | 0.1 + 1.1 + 2.9 + 3.10 |
| S-13 | 3.2 | B-03 | 3.4 |
| S-14 | 3.9 | B-04 | 1.3 |
| | | B-05 | 3.3 |
| | | B-06 | 3.5 |
| | | B-07 | 3.1 |
| | | B-08 | 3.1 |
| | | B-09 | ✅ hecho (`aa4bdf8`) |
| | | B-10 | 3.7 |

**33 de 33.** Dos ya cerrados, 31 con tarea asignada.

## Lo que este plan deja pendiente a propósito

- **La limpieza del historial de git** (`git-filter-repo` + `push --force`). Es de S-01, la
  rotación ya la dejó sin urgencia, y rompe los clones de todo el mundo: la coordina Michael, no
  cabe en una tarea de este plan.
- **La CSP completa con nonce.** Va con Recharts en la Fase 2 (Tarea 1.6, paso 1).
- **S-12.** Va con el primer endpoint que escriba, en la Fase 4.
