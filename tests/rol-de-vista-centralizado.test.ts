import { afterAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Ticket 028 / ADR 0028 — regla verificable: **nadie decide alcance, permiso ni
 * proyeccion leyendo `session.user.rol` crudo.** La respuesta vive en `rolDeVista`
 * (`lib/auth/vista.ts`), una sola definicion (ADR 0024). Quien necesita "con que rol
 * actua esta sesion" llama `rolDeVista(session)`, que estrecha por la vista; quien lee
 * `session.user.rol` a secas se salta esa proyeccion.
 *
 * Por que un guardian y no cuidado al escribir: la pregunta "¿con que rol pinto/guardo
 * esta pantalla?" vivia contestada a mano y esas copias que se desincronizan fueron la
 * causa de que el hueco de `/recursos` sobreviviera al ticket 024. El ADR 0025 punto 5
 * lo dijo, pero se sostenia solo en la revision. Este guardian lo recorre.
 *
 * **DOS formas de la misma falta:**
 *   A. **Comparar CUALQUIER rol con un literal**: `session.user.rol === "closer"`,
 *      pero tambien `actor.rol === "closer"`, `u.rol === "gerente"` o `fila.rol !=
 *      "developer"` (`===`, `!==`, `==`, `!=`, en cualquier orden). Antes esta forma
 *      exigia `.user` antes de `.rol`, razonando que un rol ya proyectado por
 *      `rolDeVista` era inocuo. **Era el tercer punto ciego del guardian en un dia**
 *      (ticket 032): venir proyectado dice de DONDE salio el valor, no si compararlo
 *      con un literal excluye al developer, que es exactamente lo que el ADR 0025
 *      punto 5 prohibe. El bug de `crearPersonaManual` (`actor.rol !== "closer"`
 *      dejaba al developer en vista `todo` sin poder crear) paso por ese hueco. Ahora
 *      CUALQUIER `.rol` comparado con un literal de rol es forma A; los pocos usos
 *      legitimos van en `EXCEPCIONES_FORMA_A`, nombrados y justificados.
 *   B. **Pasar `session.user.rol` SIN PROYECTAR como valor** (a una funcion que decide
 *      alcance/permiso —`buscarPersonas`, `esAdministrador`, un `actorDe`—, o
 *      devolverlo). No es una comparacion literal, es usar el valor crudo. Es la clase
 *      de hueco que se escapo en `personas/acciones.ts`, `productos/acciones.ts` y
 *      `anulaciones.ts`: el guardian viejo (solo forma A) no la veia.
 *
 * Como casi todo el codigo proyectado usa `rolDeVista(session)` (que NO menciona
 * `.user.rol`), la forma B se detecta simplemente: cualquier `.user.rol` en el codigo
 * de `app/`, `lib/` o `scripts/` es sospechoso, salvo las EXCEPCIONES EXPLICITAS de
 * abajo. Esto es mas amplio que "pasarlo a una funcion" a proposito: tambien caza
 * asignarlo, guardarlo en una variable o devolverlo, que son las mismas maneras de
 * saltarse la proyeccion.
 *
 * Mismo molde que el guardian de slugs (`tests/contrato-extension.test.ts`) y el de
 * vigencia (`tests/vigencia-centralizada.test.ts`): analisis de texto sobre el arbol
 * real. La forma A se busca sobre la fuente SIN COMENTARIOS pero CON cadenas (el
 * literal de rol es justo lo que hay que ver); la forma B, sobre la fuente con
 * comentarios Y cadenas borrados (para no gritar por la prosa que menciona
 * `session.user.rol`). Mas una prueba aparte de que el detector no es trivial.
 */

const RAIZ = fileURLToPath(new URL("../", import.meta.url));

/** Se recorren `app/` (paginas y acciones), `lib/` (mutaciones y queries) Y `scripts/`. */
const DIRECTORIOS = ["app", "lib", "scripts"];

const EXTENSIONES = new Set([".ts", ".tsx"]);

/** Los tres roles: comparar el rol de la sesion con cualquiera es la forma A. */
const ROLES = ["gerente", "closer", "developer"];

/**
 * EXCEPCIONES EXPLICITAS: los unicos sitios donde leer `session.user.rol` crudo es
 * legitimo, cada uno nombrado a mano con su justificacion. No basta con que el
 * detector no las vea por accidente (mismo criterio que `tests/vigencia-centralizada`).
 *
 * La clave es la RUTA relativa; el valor es el porque. Todas comparten el mismo
 * fundamento: leen el rol como IDENTIDAD ("¿quien sos realmente?") o como la DEFINICION
 * misma, no como una proyeccion de pantalla que la vista deba poder estrechar.
 */
const EXCEPCIONES: Record<string, string> = {
  // La DEFINICION: `rolDeVista`/`proyectarRol` leen el rol real para decidir la
  // proyeccion. Es el unico modulo autorizado a partir del rol crudo; todos los demas
  // lo importan. Si esto contara como violacion, la regla se morderia la cola.
  [path.join("lib", "auth", "vista.ts")]:
    "la definicion misma: rolDeVista parte del rol real para proyectarlo",

  // El callback que POBLA `session.user.rol` desde el token. Es la escritura del campo,
  // no una lectura para decidir; sin ella no existiria el valor que todo lo demas usa.
  [path.join("lib", "auth", "config.ts")]:
    "el callback de Auth.js que escribe session.user.rol desde el token",

  // La server action que cambia la vista se decide por el rol REAL (`esAccesoTotal`):
  // solo el developer puede cambiar de vista, y eso NO se estrecha con la vista misma
  // —seria absurdo que ponerse en vista closer te quitara el selector para salir—.
  [path.join("app", "(app)", "acciones-vista.ts")]:
    "quien puede cambiar de vista se decide por el rol real, no por la vista",

  // El selector "ver como" del menu: se muestra solo al developer por su rol REAL, y
  // siempre, independiente de la vista activa (es la unica salida de la vista closer).
  [path.join("app", "(app)", "layout.tsx")]:
    "el selector de vista se muestra por el rol real (esAccesoTotal), no por la vista",

  // `/api/me` responde IDENTIDAD ("¿quien soy?"), no proyeccion de pantalla. Devolver
  // aqui el rol de vista mentiria sobre quien es realmente la cuenta.
  [path.join("app", "api", "me", "route.ts")]:
    "identidad: /api/me devuelve quien es la cuenta, no como proyecta una pantalla",

  // `destinoInicial` decide A DONDE ATERRIZA alguien al ENTRAR: un developer aterriza
  // donde aterriza un developer, no donde un closer. Es "¿quien sos al entrar?", una
  // decision de identidad, no una proyeccion de una pantalla ya abierta.
  [path.join("app", "page.tsx")]:
    "identidad al entrar: destinoInicial usa el rol real de quien inicia sesion",
  [path.join("app", "login", "page.tsx")]:
    "identidad al entrar: destinoInicial usa el rol real de quien ya tiene sesion",
};

/**
 * EXCEPCIONES DE LA FORMA A: los unicos sitios donde comparar un `.rol` (de la
 * variable que sea, no solo `session.user.rol`) contra un literal de rol es legitimo,
 * cada uno nombrado y justificado. Una comparacion literal NO tiene lectura inocente
 * por defecto —excluir al developer es justo lo que el ADR 0025 punto 5 prohibe—, asi
 * que lo que caiga aca tiene que argumentar por que NO le quita nada al developer.
 *
 * Es un mapa aparte del de la forma B a proposito: leer `session.user.rol` como
 * identidad (forma B) y comparar un rol proyectado con un literal (forma A) son faltas
 * distintas y se justifican distinto, y el detector de forma A se prueba sobre un arbol
 * de mentira sin estas excepciones.
 */
const EXCEPCIONES_FORMA_A: Record<string, string> = {
  // Validacion de FORMULARIO, no autorizacion de un actor: el esquema zod de usuarios
  // pregunta si el rol que se le ESTA ASIGNANDO a una cuenta nueva exige closer_id y
  // programa. `datos.rol` es el rol que entra por el formulario, no el de una sesion
  // que actua; la rama no le niega nada al developer (a el se le cargan sus datos por
  // otra via, ticket 028). Es una definicion de que campos pide cada rol, no una reja.
  [path.join("lib", "catalogo", "usuarios.ts")]:
    "validacion de formulario: que campos exige el rol que se asigna, no autorizacion de un actor",
};

/**
 * Reemplaza comentarios y cadenas por espacios, conservando saltos de linea (para que
 * los numeros de linea sigan siendo los del archivo). Necesario porque este repo
 * comenta en espanol y `session.user.rol` aparece en la prosa por todas partes.
 * Copiado en espiritu de `tests/vigencia-centralizada.test.ts`.
 */
function limpiar(fuente: string): string {
  const salida: string[] = [];
  let estado: "codigo" | "linea" | "bloque" | "simple" | "doble" | "template" = "codigo";
  let i = 0;
  const blanco = (c: string) => (c === "\n" ? "\n" : " ");

  while (i < fuente.length) {
    const c = fuente[i];
    const par = fuente.slice(i, i + 2);

    if (estado === "codigo") {
      if (par === "//") { estado = "linea"; salida.push(" ", " "); i += 2; continue; }
      if (par === "/*") { estado = "bloque"; salida.push(" ", " "); i += 2; continue; }
      if (c === "'") { estado = "simple"; salida.push(" "); i += 1; continue; }
      if (c === '"') { estado = "doble"; salida.push(" "); i += 1; continue; }
      if (c === "`") { estado = "template"; salida.push(" "); i += 1; continue; }
      salida.push(c); i += 1; continue;
    }
    if (estado === "linea") {
      if (c === "\n") estado = "codigo";
      salida.push(blanco(c)); i += 1; continue;
    }
    if (estado === "bloque") {
      if (par === "*/") { estado = "codigo"; salida.push(" ", " "); i += 2; continue; }
      salida.push(blanco(c)); i += 1; continue;
    }
    if (estado === "simple" || estado === "doble") {
      if (c === "\\") { salida.push(" ", " "); i += 2; continue; }
      if ((estado === "simple" && c === "'") || (estado === "doble" && c === '"')) estado = "codigo";
      salida.push(blanco(c)); i += 1; continue;
    }
    // template: sin interpolacion fina; basta con blanquear hasta el cierre. Un
    // `${session.user.rol}` en un template seria raro y, si apareciera, blanquearlo
    // es el lado seguro (no gritar), no el peligroso.
    if (c === "\\") { salida.push(" ", " "); i += 2; continue; }
    if (c === "`") { estado = "codigo"; }
    salida.push(blanco(c)); i += 1;
  }
  return salida.join("");
}

/**
 * Como `limpiar`, pero CONSERVA las cadenas: solo borra los comentarios. La forma A
 * necesita ver el literal de rol (`"closer"`) para reconocer la comparacion, asi que
 * no se puede correr sobre la fuente con las cadenas blanqueadas; pero SI hay que
 * borrar los comentarios, o cualquier prosa que escriba `actor.rol === "closer"` (como
 * la que documenta este mismo guardian y las mutaciones de personas) saldria como
 * violacion. Antes la forma A corria sobre el crudo porque exigia `.user.rol` y esa
 * cadena casi no aparece en prosa; al abrirla a cualquier `.rol` (ticket 032) hay que
 * quitar los comentarios de verdad.
 */
function sinComentarios(fuente: string): string {
  const salida: string[] = [];
  let estado: "codigo" | "linea" | "bloque" | "simple" | "doble" | "template" = "codigo";
  let i = 0;
  const blanco = (c: string) => (c === "\n" ? "\n" : " ");

  while (i < fuente.length) {
    const c = fuente[i];
    const par = fuente.slice(i, i + 2);

    if (estado === "codigo") {
      if (par === "//") { estado = "linea"; salida.push(" ", " "); i += 2; continue; }
      if (par === "/*") { estado = "bloque"; salida.push(" ", " "); i += 2; continue; }
      if (c === "'") { estado = "simple"; salida.push(c); i += 1; continue; }
      if (c === '"') { estado = "doble"; salida.push(c); i += 1; continue; }
      if (c === "`") { estado = "template"; salida.push(c); i += 1; continue; }
      salida.push(c); i += 1; continue;
    }
    if (estado === "linea") {
      if (c === "\n") estado = "codigo";
      salida.push(blanco(c)); i += 1; continue;
    }
    if (estado === "bloque") {
      if (par === "*/") { estado = "codigo"; salida.push(" ", " "); i += 2; continue; }
      salida.push(blanco(c)); i += 1; continue;
    }
    // Dentro de una cadena las conservamos tal cual (incluido lo que parezca un
    // comentario): un `//` dentro de un string no abre un comentario.
    if (estado === "simple" || estado === "doble") {
      if (c === "\\") { salida.push(c, fuente[i + 1] ?? ""); i += 2; continue; }
      if ((estado === "simple" && c === "'") || (estado === "doble" && c === '"')) estado = "codigo";
      salida.push(c); i += 1; continue;
    }
    // template
    if (c === "\\") { salida.push(c, fuente[i + 1] ?? ""); i += 2; continue; }
    if (c === "`") { estado = "codigo"; }
    salida.push(c); i += 1;
  }
  return salida.join("");
}

/**
 * Forma A: comparacion de CUALQUIER `.rol` contra un literal de rol —`session.user.rol
 * === "closer"`, pero tambien `actor.rol === "closer"`, `u.rol === "gerente"`,
 * `fila.rol != "developer"`— en cualquiera de los dos ordenes. Ya NO exige `.user`:
 * venir de un rol proyectado por `rolDeVista` no vuelve inocua la comparacion literal
 * (ticket 032). `datos.rol` de un formulario tambien cae, y por eso hay
 * `EXCEPCIONES_FORMA_A` para el unico caso legitimo. Se corre sobre la fuente sin
 * comentarios (pero con cadenas), asi que la prosa no dispara.
 */
function comparacionesLiteral(sinComs: string): number[] {
  const rolLit = ROLES.join("|");
  // Un acceso a `.rol` sobre cualquier cadena de identificadores/propiedades, con `?.`
  // opcional: `x.rol`, `session.user.rol`, `session?.user?.rol`, `fila?.rol`.
  const acceso = `[A-Za-z_$][\\w$]*(?:\\s*\\??\\s*\\.\\s*[A-Za-z_$][\\w$]*)*\\s*\\??\\s*\\.\\s*rol`;
  const patrones = [
    new RegExp(`${acceso}\\s*(===|!==|==|!=)\\s*["'](${rolLit})["']`),
    new RegExp(`["'](${rolLit})["']\\s*(===|!==|==|!=)\\s*${acceso}`),
  ];
  const lineas = sinComs.split("\n");
  const hits: number[] = [];
  lineas.forEach((linea, i) => {
    if (patrones.some((p) => p.test(linea))) hits.push(i + 1);
  });
  return hits;
}

/** Forma B: uso crudo de `session.user.rol` (o `?.user?.rol`) sin proyectar. */
function usosCrudos(limpio: string): number[] {
  // `.user` seguido de `.rol` o `?.rol`, tolerando el `?.` opcional antes de `user`.
  const patron = /\.user\s*\??\s*\.\s*rol\b/;
  const lineas = limpio.split("\n");
  const hits: number[] = [];
  lineas.forEach((linea, i) => {
    if (patron.test(linea)) hits.push(i + 1);
  });
  return hits;
}

/** Todos los archivos de codigo bajo `dir`, recursivo. */
function archivosDeCodigo(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const encontrados: string[] = [];
  for (const entrada of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) encontrados.push(...archivosDeCodigo(completo));
    else if (EXTENSIONES.has(path.extname(entrada.name))) encontrados.push(completo);
  }
  return encontrados;
}

/**
 * Recorre `app/`, `lib/` y `scripts/` y devuelve las violaciones: comparaciones
 * literales (forma A) y usos crudos de `session.user.rol` (forma B) que no esten en
 * sus respectivas excepciones. Las dos tablas de excepciones se pasan aparte para
 * poder probar el detector sobre un arbol de mentira sin las excepciones reales.
 */
function violaciones(
  raiz: string,
  excepciones: Record<string, string>,
  excepcionesFormaA: Record<string, string>,
): string[] {
  const fuera: string[] = [];
  for (const dir of DIRECTORIOS) {
    for (const archivo of archivosDeCodigo(path.join(raiz, dir))) {
      const ruta = path.relative(raiz, archivo);
      const eximido = ruta in excepciones;
      const eximidoFormaA = ruta in excepcionesFormaA;
      const crudo = fs.readFileSync(archivo, "utf8");
      const limpio = limpiar(crudo);

      // Forma A: se detecta sobre la fuente SIN COMENTARIOS pero CON cadenas (hay que
      // ver el literal `"closer"`). Se exime solo por `EXCEPCIONES_FORMA_A`, nombradas:
      // una comparacion literal no es inocente por venir de un rol proyectado (032).
      const lineasFormaA = new Set(
        eximidoFormaA ? [] : comparacionesLiteral(sinComentarios(crudo)),
      );
      for (const linea of lineasFormaA) {
        fuera.push(`${ruta}:${linea}: compara el rol con un literal (forma A)`);
      }
      // Forma B se exime por las excepciones nombradas. Se detecta sobre el LIMPIO
      // para no gritar por la prosa que menciona `session.user.rol`. Una linea ya
      // marcada como forma A no se re-reporta: una comparacion literal ES tambien un
      // uso crudo, y la forma A es el diagnostico mas preciso.
      if (eximido) continue;
      for (const linea of usosCrudos(limpio)) {
        if (lineasFormaA.has(linea)) continue;
        fuera.push(`${ruta}:${linea}: usa session.user.rol crudo sin rolDeVista (forma B)`);
      }
    }
  }
  return fuera.sort();
}

describe("rol de vista centralizado (ticket 028, ADR 0028)", () => {
  it("rolDeVista es una funcion y vive en lib/auth/vista.ts", async () => {
    const modulo = (await import("@/lib/auth/vista")) as Record<string, unknown>;
    expect(typeof modulo.rolDeVista).toBe("function");
  });

  it("nadie en app/, lib/ ni scripts/ decide por session.user.rol crudo ni compara un rol con un literal (salvo excepciones nombradas)", () => {
    const fuera = violaciones(RAIZ, EXCEPCIONES, EXCEPCIONES_FORMA_A);
    expect(
      fuera,
      `El ticket 028 exige decidir con rolDeVista, no con session.user.rol crudo, y el ` +
        `032 prohibe comparar CUALQUIER .rol con un literal (fue el bug del developer ` +
        `sin poder crear persona). Arregla usando un predicado de lib/auth/roles.ts, o ` +
        `si es un uso legitimo agregalo a EXCEPCIONES (identidad) o EXCEPCIONES_FORMA_A ` +
        `(comparacion) con su justificacion:\n` +
        fuera.join("\n"),
    ).toEqual([]);
  });

  it("las excepciones nombradas existen y estan justificadas", () => {
    for (const mapa of [EXCEPCIONES, EXCEPCIONES_FORMA_A]) {
      for (const [ruta, motivo] of Object.entries(mapa)) {
        expect(fs.existsSync(path.join(RAIZ, ruta)), `la excepcion ${ruta} ya no existe`).toBe(true);
        expect(motivo.length, `la excepcion ${ruta} necesita justificacion`).toBeGreaterThan(10);
      }
    }
  });

  // Prueba de que el detector no es trivial: sobre un arbol temporal encuentra ambas
  // formas, deja pasar `rolDeVista(session)`, respeta las excepciones y no confunde la
  // prosa que menciona `session.user.rol` en un comentario o una cadena.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rol-vista-"));

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("detecta forma A (cualquier .rol) y forma B, respeta rolDeVista, ambas excepciones, scripts/ y la prosa", () => {
    const app = path.join(tmp, "app");
    const lib = path.join(tmp, "lib");
    const scripts = path.join(tmp, "scripts");
    fs.mkdirSync(app, { recursive: true });
    fs.mkdirSync(lib, { recursive: true });
    fs.mkdirSync(scripts, { recursive: true });

    // Forma A: comparacion literal, dos variantes de orden, y —lo nuevo del 032— NO
    // solo `session.user.rol`: tambien `actor.rol` (rol ya proyectado) y `u.rol`.
    fs.writeFileSync(
      path.join(app, "forma-a.ts"),
      [
        'const a = session.user.rol === "closer" ? "closer" : "gerente";',
        'const b = "developer" !== session.user.rol;',
        'if (actor.rol === "closer") registrar();',
        'const d = u.rol != "gerente";',
      ].join("\n"),
    );

    // Forma A en scripts/: el guardian ahora recorre ese directorio (hallazgo del 032,
    // la salvaguarda del ultimo administrador comparaba `u.rol === "gerente"`).
    fs.writeFileSync(
      path.join(scripts, "cli.ts"),
      ['if (existe.rol === "gerente") frenar();'].join("\n"),
    );

    // Forma B: uso crudo pasado a una funcion o devuelto.
    fs.writeFileSync(
      path.join(lib, "forma-b.ts"),
      [
        "const s = buscarPersonas(session.user.id, session.user.rol, texto, db);",
        "return { rol: session.user.rol };",
        "if (esAdministrador(session?.user?.rol)) return;", // con optional chaining
      ].join("\n"),
    );

    // Limpio: usa rolDeVista, predicados y variables ya proyectadas. `rol === "closer"`
    // (sin `.rol`) NO es forma A: no hay acceso a la propiedad `.rol`. `esAdministrador`
    // y `trabajaLeads` son la forma correcta de preguntar por capacidad.
    fs.writeFileSync(
      path.join(app, "limpio.ts"),
      [
        "const rol = await rolDeVista(session);",
        'const c = rol === "closer" ? "closer" : "gerente";',
        "const admin = esAdministrador(rol);",
        "if (!trabajaLeads(actor.rol)) throw new Error();",
      ].join("\n"),
    );

    // Prosa/cadena: menciona una comparacion de rol en un comentario y en un string,
    // incluida la forma nueva `actor.rol === "closer"`. Nada de esto es codigo: ni la
    // forma A (se corre sin comentarios) ni un literal citado dentro de un string
    // pueden aparecer como violacion.
    fs.writeFileSync(
      path.join(lib, "prosa.ts"),
      [
        '// ojo: no escribas actor.rol === "closer" a mano, usa trabajaLeads',
        "// tampoco leas session.user.rol crudo, usa rolDeVista",
        'const MSG = "el actor.rol === closer viejo se elimino";',
      ].join("\n"),
    );

    // Una excepcion de identidad (forma B) de mentira: sin ella `identidad.ts` gritaria.
    fs.writeFileSync(
      path.join(app, "identidad.ts"),
      ["return session.user.rol; // identidad"].join("\n"),
    );

    // Una excepcion de forma A de mentira: una validacion de formulario que compara el
    // rol ENTRANTE con un literal. Sin la excepcion, gritaria como forma A.
    fs.writeFileSync(
      path.join(lib, "validacion.ts"),
      ['if (datos.rol === "closer") pedirCloserId();'].join("\n"),
    );

    const excepcionesDePrueba = {
      [path.join("app", "identidad.ts")]: "identidad de prueba, justificada aqui",
    };
    const excepcionesFormaADePrueba = {
      [path.join("lib", "validacion.ts")]: "validacion de formulario de prueba, justificada aqui",
    };

    expect(violaciones(tmp, excepcionesDePrueba, excepcionesFormaADePrueba)).toEqual([
      `${path.join("app", "forma-a.ts")}:1: compara el rol con un literal (forma A)`,
      `${path.join("app", "forma-a.ts")}:2: compara el rol con un literal (forma A)`,
      `${path.join("app", "forma-a.ts")}:3: compara el rol con un literal (forma A)`,
      `${path.join("app", "forma-a.ts")}:4: compara el rol con un literal (forma A)`,
      `${path.join("lib", "forma-b.ts")}:1: usa session.user.rol crudo sin rolDeVista (forma B)`,
      `${path.join("lib", "forma-b.ts")}:2: usa session.user.rol crudo sin rolDeVista (forma B)`,
      `${path.join("lib", "forma-b.ts")}:3: usa session.user.rol crudo sin rolDeVista (forma B)`,
      `${path.join("scripts", "cli.ts")}:1: compara el rol con un literal (forma A)`,
    ]);
  });
});
