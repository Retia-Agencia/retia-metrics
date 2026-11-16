## Conventions

- **El gestor de paquetes es `npm`, no `pnpm`** (ADR 0001). Donde una instruccion diga `pnpm X`,
  corre `npm run X`.
- **`revalidatePath` NO refresca la pantalla que acaba de escribir.** Una server action que muta
  y quiere que la vista actual cambie llama `router.refresh()` en el cliente; `revalidatePath`
  sirve para las OTRAS rutas cuyo cache de ruta quedaria viejo. Y en una ruta dinamica se invalida
  por su **patron** con el tipo (`revalidatePath("/personas/[id]", "page")`), no por un path
  concreto ni con `"layout"` sobre un segmento que no tiene layout propio: eso no coincide con
  nada y **no falla, simplemente no invalida**. Costo un falso "no funciona" en el recorrido del
  18-sep, con la escritura correcta en la base y la pantalla mostrando el total anterior.
- **Next 16 renombro `middleware.ts` a `proxy.ts`.** El archivo vive en la raiz con ese nombre.
- **shadcn/ui corre sobre `@base-ui/react`, no sobre Radix.** Se usa `render={<Componente />}` en
  vez de `asChild`, y `onClick` en vez de `onSelect` en los items de menu. **Y Base UI es ESTRICTO
  con la composicion: una parte fuera de su contenedor lanza en tiempo de ejecucion, no en
  compilacion.** `DropdownMenuLabel` es `Menu.GroupLabel` y exige vivir dentro de un `Menu.Group` o
  un `Menu.RadioGroup`; suelto tira `MenuGroupContext is missing`. Eso paso de verdad (18-sep) y
  como el menu de usuario vive en el sidebar, **el error se llevaba puesta la pagina entera al
  ABRIR el menu**, con 543 tests en verde. Estuvo roto varios dias.
- 🩸 **El recorrido visual del 20-sep encontro DOS bugs con 669 tests en verde**, y los dos son
  del mismo tipo: **codigo que ningun test podia ver**. En este repo NO hay tests de componentes,
  asi que una condicion de `disabled` mal escrita deja un boton muerto sin que nada falle. Y una
  funcion de `lib/` **que nadie llama** puede estar mal desde el dia que se escribio: el conteo de
  referencias de un recurso miraba solo `reemplazaA` ("quien me reemplazo a MI"), asi que la
  version VIGENTE —la unica que el usuario toca— contaba CERO y se borraba, decapitando su
  historial con una FK `set null` que no protesta. **Antes de dar por probada una funcion de `lib/`,
  mira quien la llama: `grep` cuesta un comando.**
- **Cargar una pantalla no es probarla, y un "recorrido visual" que solo carga no sirve.** Lo que
  rompe en Base UI son las INTERACCIONES: abrir un menu, desplegar un select, abrir un dialogo.
  Ningun test de este repo ve un error de contexto de React en tiempo de ejecucion. Cuando revises
  una pantalla, **hace clic en todo lo que se abre**, y mira la consola del navegador.
- **Y para una regla de PERMISO, hacer clic tampoco alcanza: hay que forjar la peticion.** Mirar
  que el boton no aparezca prueba lo unico que un atacante no hace. Las dos reglas duras de arriba
  —"el rol se enforza en el servidor" y "esconder un boton no es seguridad"— estuvieron escritas
  meses sin que ningun recorrido las midiera. **Como se muerde una server action** (hecho el 18-sep
  con el 031): envolves `window.fetch` en la pagina para capturar la cabecera `Next-Action` al
  enviar el formulario UNA vez desde la vista que si puede; con ese id invocas la accion a mano,
  saltandote la interfaz entera, desde la vista que NO deberia poder. Se espera el mensaje de 403 y
  **la base sin moverse**. En el mismo viaje se prueba la otra mitad: meterle al cuerpo un `id`
  ajeno y comprobar que se ignora, porque el objetivo sale de la sesion y no del input.
  **Un contrato que nadie mordio es una creencia.**
- **`next-auth/jwt` solo re-exporta `@auth/core/jwt`.** La augmentacion de `JWT` tiene que
  declararse sobre `@auth/core/jwt` o no aplica (ver `types/next-auth.d.ts`).
- **`LayoutProps` / `PageProps` los genera `next build`.** No dependas de ellos: tipa las props a
  mano para que `tsc --noEmit` corra limpio sin build previo.
- 🩸 **Un cambio que toca un componente cliente (`"use client"`) corre `npm run build` antes de empujar** (2-oct, 142).
  Typecheck, lint y tests pasan con un import que mete la base al navegador: un cliente que importa un VALOR de un
  modulo de `lib/` que carga `lib/db` (aunque sea un nombre de etapa) revienta solo en el build de Vercel
  (`Module not found: 'fs'`). Paso el 2-oct con `components/admin/estados-llegada-admin.tsx` y la base ya migrada:
  produccion sirvio el codigo viejo contra la 0058 unos 5 minutos. Lo que un cliente necesita de `lib/` llega por
  props desde la pagina del servidor (como `nombreDeEtapa`); `import type` si se puede. En un worktree, `next build`
  corre con la copia APFS de `node_modules` (abajo), no con el enlace.
- 🩸 **Un servidor solo importa COMPONENTES de un archivo `"use client"`** (9-nov, ticket 360). Un valor que no es componente
  (constante, arreglo, función) exportado desde un archivo cliente llega al servidor como una REFERENCIA, no como el valor:
  `[...CLAVES_DE_FECHA_LISTA]` reventó Calls con "is not iterable" y typecheck, lint y 181 tests seguían en verde; solo se vio
  al abrir la pantalla. Lo que ambos lados necesitan vive en `lib/` sin `"use client"`, y el componente lo importa de ahí.
  Lo vigila `tests/frontera-cliente-guardian.test.ts` (nombre que no empieza con mayúscula+minúscula, o tipo, importado de un
  archivo cliente por un archivo de servidor). Y sigue valiendo la regla de arriba: tras tocar un componente cliente, `npm run
  build` y **abrir la pantalla** con la base local, mirando la consola.
- **Worktree para delegar: los tests sí, Turbopack no** (1-oct). Un worktree con `node_modules` enlazado
  (junction a la del checkout principal) corre `npm test`, typecheck y lint, pero `next build` y `next dev`
  fallan ("Symlink ... points out of the filesystem root"). La build y el recorrido visual se hacen en el
  checkout principal tras commit en la rama. Para quitar el worktree, primero `rmdir node_modules` (borra el
  enlace, no la carpeta real) y después `git worktree remove`. Y **Next 16 deja UN solo `next dev` por
  carpeta**: si `dev:local` dice "Another next dev server is already running", mira de quién es el PID antes de
  matarlo (un `npm run dev` escribe en producción); una `next build` en la misma carpeta rompe un `dev` vivo.
  **Si el checkout principal está ocupado por otra sesión, el recorrido sale del worktree** (095, 1-oct): se
  cambia el enlace por una copia APFS (`rm node_modules && cp -cR <principal>/node_modules .`, unos 14 s y sin
  gastar disco) y `PORT=3095 npm run dev:local`. 🍪 **Dos `next dev` en `localhost` se pisan la sesión**: las
  cookies no distinguen puertos, así que el login de una pestaña tumba el de la otra (vuelves a `/login` sin
  error). Tampoco sirve `127.0.0.1`: Next dev responde 403 a sus propios recursos, la página no hidrata y los
  diálogos no abren. Entra por un subdominio de `localhost` (`app095.localhost:3095`), que tiene sus propias
  cookies; uno distinto por rol (`closer095.localhost`) para tener dos sesiones a la vez.
- **`experimental.staleTimes.dynamic = 15` (next.config.ts):** volver a una pestaña vista dentro de 15 s sale del caché de cliente; las escrituras propias (server action con `revalidatePath` o `router.refresh()`) lo purgan entero, pero un cambio externo (otro closer, webhook) se ve hasta 15 s tarde. No subirlo sin repetir la prueba A→B→A tras mutar.
- **Una herramienta del MCP no copia a su pantalla: la pantalla y la herramienta importan lo mismo (6-nov, ticket 348).**
  Listas de valores, esquemas de filtros, reglas de combinación y capacidades por rol viven en UN módulo de `lib/`
  (ej. `lib/queries/filtros-de-lista.ts`, `capacidadParaMetrica`). Nada de listas o enums escritos a mano si ya existen
  como tipo: se derivan, con un chequeo de exhaustividad en compilación en los dos sentidos para que agregar un miembro
  obligue a actualizar. La herramienta expone los mismos filtros que la app, no un subconjunto. Olor: un literal repetido
  entre `app/` y `lib/mcp/`. Es la regla del ADR 0012 aplicada al MCP: lo que crece no puede estar duplicado.
- **Un paquete no se instala antes del codigo que lo usa.** Instalar por adelantado es
  abstraccion especulativa (ADR 0006).
- **Dentro de una plantilla `sql` de drizzle, las columnas salen SIN calificar.**
  `sql`select count(*) from ${people} where ${people.programId} = ${programs.id}`` se renderiza como
  `select count(*) from "people" where "program_id" = "id"`: ese `"id"` resuelve a la columna de la
  tabla interna, la comparacion siempre da falso y **el conteo devuelve 0 sin lanzar ningun error**.
  Descubierto en el ticket 025, con un test que ya estaba escrito; sin ese test la pantalla habria
  mostrado ceros crebles. **No escribas subconsultas correlacionadas con la plantilla `sql`**: agrupa
  aparte y une en memoria, que a esta escala es gratis y se lee correcto. Dentro de una consulta de
  UNA sola tabla la plantilla es segura, porque no hay ambiguedad que resolver.
  **Afinado el 19-sep midiendolo, porque la regla de arriba esta escrita mas ancha de lo que es:**
  lo que desactiva la calificacion es meter una TABLA en la plantilla (`${people}`), no la plantilla
  en si. Una plantilla que solo referencia columnas las sigue calificando —`sql`${syncRuns.fuentesLeidas}``
  dentro de un select con join se renderiza `"sync_runs"."fuentes_leidas"`, comprobado con
  `.toSQL()`—. La conducta practica no cambia (**nada de subconsultas correlacionadas**), pero no
  hay que desconfiar de un cast de tipo sobre una columna ni "arreglarlo" a ciegas. Si dudas,
  imprime `query.toSQL().sql`: cuesta un comando y responde de verdad.
- 🩸 **Un `Date` nunca va interpolado en una plantilla `sql`: usa `gte`/`lt`/`eq` de drizzle.** La
  plantilla le manda el valor crudo al driver y depender de su conversion implicita no es portable:
  el driver anterior, postgres-js, lo rechazaba con `ERR_INVALID_ARG_TYPE`, mientras PGlite y `pg` lo
  aceptan. Los operadores pasan el valor por el mapeo de la columna. Estuvo en `leerHechos` de `moverEtapa` y salio
  el 28-sep sembrando la base local del 113, no en un test.
- **La base es Supabase y se usa por `drizzle-orm/node-postgres` (`pg`), con transacciones de verdad**
  (ADR 0047, 22-sep; antes era Neon con `neon-http`, sin transacciones). La app entra por el
  **pooler en modo transaction (6543)**, con un pool por proceso y tope de 5 conexiones;
  `drizzle-kit` por la conexion de **5432** (`DATABASE_URL_DIRECTA`). `ejecutarJuntas` es una
  transaccion real y corre **en orden**; quien necesite leer y decidir dentro de la misma
  transaccion usa `db.transaction` directo. **La exclusion mutua sigue viviendo en un indice
  unico**, no en `pg_advisory_lock`: con el pooler en modo transaction un lock de sesion no
  sobrevive entre consultas. **Hecho en el sync (ADR 0005):** el INSERT de la corrida ES el
  candado, contra un indice unico parcial `WHERE estado = 'corriendo'`. Si necesitas exclusion
  mutua en otra parte, ese es el molde: no hay candado que pedir ni que acordarse de soltar.
  Un script de `scripts/` **sale con `process.exit`**: `pg` deja el pool abierto y el
  proceso se queda colgado.
- **UN solo proyecto de Supabase, "CRM Retia" (ref `hfqmiyiuyqapdsbywrag`), y ES produccion**
  (Mani, 28-sep; enmienda el ADR 0047, que pedia `dev` y produccion). No hay base de pruebas: local
  (`npm run dev`, los scripts, `db:migrate`) escribe en la base real. **Los previews de Vercel no tienen
  `DATABASE_URL` a proposito** y se trabaja todo en `main`. La regla de Mani: **asegurar la integridad
  antes de publicar.** En la practica: (1) una migracion se prueba primero en PGlite, que aplica TODAS
  las migraciones en cada `npm test`, y su SQL se lee antes de aplicarla; (2) nada se empuja a `main`
  sin typecheck, lint y los tests del cambio limpios, y la suite completa la valida el checkpoint (Feedback
  loops); (3) toda escritura de
  datos a mano o por script pide el ok de Mani; (4) antes de escribir, **mirar el ref dentro de la
  connection string** (`postgres.<ref>@...`), no el nombre de la variable. Lo que PGlite no ve y solo
  aparece en la base real: el pooler (`prepare: false`). 🩸 **La Data API de Supabase va APAGADA**:
  publica las tablas por REST con una llave anonima y la app no la usa.
- 🩸 **El SQL que genera `drizzle-kit` se LEE antes de aplicarlo, siempre.** Medido en la 0020
  (22-sep): de los cuatro defectos que traia, dos eran destructivos y dos la hacian fallar.
  (1) Expresaba el renombre `people` -> `leads` como `DROP TABLE ... CASCADE` + `CREATE TABLE`,
  que habria borrado 2.059 leads en `dev` y 4.791 en `production`; (2) ponia los `DROP CONSTRAINT`
  DESPUES del `DROP TABLE ... CASCADE` que ya se los habia llevado; (3) creaba el indice unico
  parcial de `sources` ANTES de desactivar la fuente vieja, con dos activas en la base; (4) dejaba
  las 271 filas de `change_log` hablando de una tabla que ya no existe. **Un `generate` es un
  borrador, no una migracion.** Reescribirla a mano no rompe el snapshot: el snapshot describe el
  esquema FINAL, no el camino.
- **Cuando `drizzle-kit generate` pregunta si algo es un renombre, la opcion por defecto (la
  primera) es SIEMPRE `create`.** Contestar eso en todo y arreglar el SQL despues es mas seguro que
  intentar acertar el rename en el prompt: un rename mal contestado escribe un `ALTER` que parece
  correcto. Si la sesion no tiene TTY, `generate` **falla en vez de colgarse** (lo dice
  explicito) — hay que darle un pty.
- **Las migraciones las genera y aplica la sesion principal, nunca un subagente** (Mani, 17-sep).
  Un agente delegado (Kiro, Codex) implementa codigo y tests, pero no corre `db:generate` ni
  `db:migrate`. `drizzle-kit generate` es interactivo: si una columna se va y otra llega en el
  mismo cambio pregunta si es un renombre, y un agente sin terminal se queda colgado ahi.
- **`drizzle-kit generate` y `migrate` estan permitidos en `.claude/settings.json`; `push` y `drop`
  estan DENEGADOS.** `push` aplica el esquema directo contra la base sin dejar archivo de
  migracion: se salta el historial, el journal y la revision, que es justo la disciplina que este
  repo enforza. `drop` borra migraciones. Ninguno de los dos se usa aqui.
- 🩸 **Una migracion con DDL sobre una tabla caliente empieza con `SET lock_timeout = '5s';`** (29-sep,
  0043). Un `ALTER TABLE` pide candado exclusivo y, mientras espera, **deja en fila toda lectura de esa
  tabla**: la 0043 espero 2 minutos detras de una transaccion de ensayo abierta 1h20m y congelo `leads`
  dos veces hasta que el `statement_timeout` la cancelo. Con `lock_timeout` falla en 5 s y se reintenta.
  Antes de aplicar, mirar `pg_stat_activity` por transacciones largas (`idle in transaction` incluido), y
  **un ensayo contra produccion no se deja abierto**. Y si la migracion QUITA columnas, primero se
  despliega el codigo sin ellas: drizzle las pide por nombre en cada `select()`.
- **Un `CHECK` nuevo se crea despues de arreglar los datos**, en la misma migracion. El de la
  0009 habria fallado con las cohortes activas que estaban sin inicio de ventas.
- **Trabajo en paralelo: olas de tickets listos, varias sesiones por persona** (1-oct, `docs/plan-reparto.md`
  §1): se ordenan solo las migraciones (una cola), los archivos calientes (un dueño por ola) y las decisiones.
- **Trabajo en paralelo: el reparto se hace por ARCHIVOS, no por el grafo de dependencias**
  (17-sep, tres sesiones sin choques). Los puntos de colision son las migraciones (journal +
  snapshot + `schema.ts`), `docs/tasks/README.md`, `docs/agents/handoff.md` y los commits. Cada
  sesion commitea nombrando sus archivos (nunca `git add -A`), nadie toca el tracker ni el
  handoff, y un coordinador revisa contra el "Done cuando", marca y migra. No van juntos dos
  tickets que escriben la misma logica ni dos que necesiten migracion.
- **Un fallo de `npm test` por timeout no es una regresion.** Los tests con PGlite aplican todas
  las migraciones; con varias sesiones compitiendo por la maquina el suite se cae en cascada por
  el reloj. Re-corre el archivo solo antes de investigar (`testTimeout` y `hookTimeout` en 20s).
- 🩸 **UNA suite por maquina, y siempre por `npm test`** (28-sep). Una corrida de 66 s se colgo
  mas de 55 minutos varias veces: tres suites a la vez (sesion, agente y un subagente que se
  relanzaba) mas workers de vitest que sobrevivian a su padre muerto. `npm test` es
  `scripts/test.mjs`: un candado por maquina (si ya hay una suite viva, sale de inmediato y dice
  cual), barre los workers huerfanos de este repo y corta el grupo de procesos entero a los
  `TEST_TIMEOUT_S` (480 s). **Nunca `npx vitest run` directo, nunca la suite en background, nunca
  relanzarla en bucle.** Un archivo suelto: `npm test -- tests/x.test.ts`. Si ves "Ya hay una suite
  corriendo", espera o mata ese pid; no lances otra. Y quien delega a un agente lo detiene por su
  tarea (en Claude Code, `TaskStop`), no matando sus procesos: el agente vivo los relanza.
- 🔑 **Todos los devs comparten el MISMO `.env.local` (29-sep, Mani): una sesion puede consultar Typeform y
  Calendly por API sin pedirle nada a nadie.** Los tokens son de dev, **ninguna ruta de la app los lee**
  (en produccion el token de Calendly vive en la base, ADR 0057). Que hay y que se puede hacer, verificado
  el 29-sep solo con lecturas:
  - `DATABASE_URL` / `DATABASE_URL_DIRECTA`: la base de produccion (ref `hfqmiyiuyqapdsbywrag`). Leer: libre.
    Escribir: pide el ok de Mani y se mira el ref antes.
  - `TYPEFORM_TOKEN`: token personal **por cuenta, no por programa**. Ve los forms de los tres programas (Comunícate con Confianza `E5F4chVT`, Tactical `GmPGBOf9`,
    ComunicArte `nkMLdeh8`), sus campos, variables, webhooks y respuestas (~3.100 y ~2.700), y ademas otros
    forms ajenos a Retia. **No es frontera de programa:** el script pasa siempre el form id explicito. Sus
    scopes no se ven por API: si una escritura da 403, falta `forms:write`.
  - `META_SYSTEM_TOKEN` (14-oct): el usuario del sistema `retia-insights` del portafolio Agencia Retia Growth, **solo
    `ads_read`** (lee gasto, árbol y agendas del pixel; no puede tocar campañas). Ve las 7 cuentas publicitarias. Usa
    `https://graph.facebook.com/v26.0` (sin versión falla). La app no lo lee: en producción vive en la base (119).
  - `CALENDLY_ACCESS_TOKEN_COMUNICARTE`, `CALENDLY_ACCESS_TOKEN_TACTICAL` y `CALENDLY_ACCESS_TOKEN_COMUNICATE_CONFIANZA` (5-oct): uno por programa, de una cuenta
    OWNER de su organizacion. Ven miembros, tipos de evento, citas y webhooks de esa organizacion. Cada
    programa usa SU token: nunca uno para consultar el otro. `CALENDLY_PAT_LOCAL_*` no se usa.
    **14-nov:** el programa AI Second Brain Jurídico (EstadoX) se retiró del CRM por completo (base, `CALENDLY_ACCESS_TOKEN_SB_JURIDICO` y
    `FORM_30X_API_KEY` de `.env.local` y de Vercel); sigue vivo fuera del CRM (HubSpot). Ya no hay fuente `form30x` ni variable de Form30x:
    `lib/form30x/` queda sin uso y se retira en un ticket aparte (ADR 0092 y 0093). Respaldo de lo borrado, fuera del repo:
    `work/retia/backups/second-brain-juridico-2026-11-14.json`.
  - **Reglas:** leer es libre; **crear, editar o borrar en Typeform, Form30x, Calendly o la base pide el ok de Mani**
    (un webhook o un form editado por API se ve igual que uno bueno y no lanza error). Nunca imprimir un token
    ni pegarlo en un commit, un ticket o el chat: se comprueba por presencia o por lo que devuelve la API. Usa
    `node` con `fetch`, no el Python del sistema (falla el certificado SSL en la maquina de Mani). Un script
    desechable se escribe en `scripts/`, se corre y se borra, sin commitearlo. Nunca `vercel env pull`.
- **Idioma:** UI en espanol. Nombres de variables, tablas y archivos sin acentos, consistentes.
  Mensajes de commit en espanol.

