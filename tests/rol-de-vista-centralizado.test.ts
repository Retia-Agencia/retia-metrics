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
 *   A. Comparar el rol de la sesion con un literal: `session.user.rol === "closer"`
 *      (`===`, `!==`, `==`, `!=`, en cualquier orden). Es la forma de las tres copias
 *      viejas ya arregladas.
 *   B. **Pasar `session.user.rol` SIN PROYECTAR como valor** (a una funcion que decide
 *      alcance/permiso —`buscarPersonas`, `esAdministrador`, un `actorDe`—, o
 *      devolverlo). No es una comparacion literal, es usar el valor crudo. Es la clase
 *      de hueco que se escapo en `personas/acciones.ts`, `productos/acciones.ts` y
 *      `anulaciones.ts`: el guardian viejo (solo forma A) no la veia.
 *
 * Como casi todo el codigo proyectado usa `rolDeVista(session)` (que NO menciona
 * `.user.rol`), la forma B se detecta simplemente: cualquier `.user.rol` en el codigo
 * de `app/` o `lib/` es sospechoso, salvo las EXCEPCIONES EXPLICITAS de abajo. Esto es
 * mas amplio que "pasarlo a una funcion" a proposito: tambien caza asignarlo, guardarlo
 * en una variable o devolverlo, que son las mismas maneras de saltarse la proyeccion.
 *
 * Mismo molde que el guardian de slugs (`tests/contrato-extension.test.ts`) y el de
 * vigencia (`tests/vigencia-centralizada.test.ts`): analisis de texto sobre el arbol
 * real —con los comentarios y las cadenas borrados, para no gritar por la prosa que
 * menciona `session.user.rol`—, mas una prueba aparte de que el detector no es trivial.
 */

const RAIZ = fileURLToPath(new URL("../", import.meta.url));

/** Se recorren `app/` (paginas y acciones) Y `lib/` (mutaciones y queries). */
const DIRECTORIOS = ["app", "lib"];

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
 * Forma A: comparacion del ROL DE LA SESION contra un literal de rol. Exige `.user`
 * antes de `.rol` (`session.user.rol`, `session?.user?.rol`): asi NO confunde
 * `actor.rol === "closer"` —donde `actor` ya lo armo la accion con `rolDeVista`, es
 * un rol ya proyectado— ni `datos.rol` de un formulario de usuarios, que no es la
 * sesion. La regla es sobre el rol crudo de la sesion, no sobre cualquier `.rol`.
 */
function comparacionesLiteral(crudo: string): number[] {
  const rolLit = ROLES.join("|");
  const usuario = `[A-Za-z_$][\\w$]*\\s*\\??\\s*\\.\\s*user\\s*\\??\\s*\\.\\s*rol`;
  const patrones = [
    new RegExp(`${usuario}\\s*(===|!==|==|!=)\\s*["'](${rolLit})["']`),
    new RegExp(`["'](${rolLit})["']\\s*(===|!==|==|!=)\\s*${usuario}`),
  ];
  const lineas = crudo.split("\n");
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
 * Recorre `app/` y `lib/` y devuelve las violaciones: comparaciones literales (forma A)
 * y usos crudos de `session.user.rol` (forma B) que no esten en las excepciones.
 * Las excepciones se pasan aparte para poder probar el detector sobre un arbol de
 * mentira sin las excepciones reales.
 */
function violaciones(raiz: string, excepciones: Record<string, string>): string[] {
  const fuera: string[] = [];
  for (const dir of DIRECTORIOS) {
    for (const archivo of archivosDeCodigo(path.join(raiz, dir))) {
      const ruta = path.relative(raiz, archivo);
      const eximido = ruta in excepciones;
      const crudo = fs.readFileSync(archivo, "utf8");
      const limpio = limpiar(crudo);

      // Forma A no se exime NUNCA: una comparacion literal no tiene lectura legitima.
      // Se detecta sobre el CRUDO: el literal de rol (`"closer"`) es justo lo que
      // `limpiar` borraria, y la comparacion `.rol === "closer"` es inequivoca aunque
      // aparezca en una linea que tambien tiene prosa (raro, y del lado seguro).
      const lineasFormaA = new Set(comparacionesLiteral(crudo));
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

  it("nadie en app/ ni lib/ decide por session.user.rol crudo (salvo excepciones nombradas)", () => {
    const fuera = violaciones(RAIZ, EXCEPCIONES);
    expect(
      fuera,
      `El ticket 028 exige decidir con rolDeVista, no con session.user.rol crudo ` +
        `(fue la causa del hueco de /recursos y de tres mas). Arregla, o si es un uso ` +
        `de identidad legitimo, agregalo a EXCEPCIONES con su justificacion:\n` +
        fuera.join("\n"),
    ).toEqual([]);
  });

  it("las excepciones nombradas existen y estan justificadas", () => {
    for (const [ruta, motivo] of Object.entries(EXCEPCIONES)) {
      expect(fs.existsSync(path.join(RAIZ, ruta)), `la excepcion ${ruta} ya no existe`).toBe(true);
      expect(motivo.length, `la excepcion ${ruta} necesita justificacion`).toBeGreaterThan(10);
    }
  });

  // Prueba de que el detector no es trivial: sobre un arbol temporal encuentra ambas
  // formas, deja pasar `rolDeVista(session)`, respeta las excepciones y no confunde la
  // prosa que menciona `session.user.rol` en un comentario o una cadena.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rol-vista-"));

  afterAll(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("detecta forma A y forma B, respeta rolDeVista, las excepciones y la prosa", () => {
    const app = path.join(tmp, "app");
    const lib = path.join(tmp, "lib");
    fs.mkdirSync(app, { recursive: true });
    fs.mkdirSync(lib, { recursive: true });

    // Forma A: comparacion literal (dos variantes de orden).
    fs.writeFileSync(
      path.join(app, "forma-a.ts"),
      [
        'const a = session.user.rol === "closer" ? "closer" : "gerente";',
        'const b = "developer" !== session.user.rol;',
      ].join("\n"),
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

    // Limpio: usa rolDeVista y variables ya proyectadas. Nada de esto es `.user.rol`.
    fs.writeFileSync(
      path.join(app, "limpio.ts"),
      [
        "const rol = await rolDeVista(session);",
        'const c = rol === "closer" ? "closer" : "gerente";',
        "const admin = esAdministrador(rol);",
      ].join("\n"),
    );

    // Prosa/cadena: menciona session.user.rol en un comentario y en un string. No es
    // codigo, no puede aparecer como violacion.
    fs.writeFileSync(
      path.join(lib, "prosa.ts"),
      [
        "// ojo: no leas session.user.rol crudo, usa rolDeVista",
        'const MSG = "el session.user.rol === closer viejo se elimino";',
      ].join("\n"),
    );

    // Una excepcion de mentira: sin ella, `identidad.ts` gritaria por forma B.
    fs.writeFileSync(
      path.join(app, "identidad.ts"),
      ["return session.user.rol; // identidad"].join("\n"),
    );

    const excepcionesDePrueba = {
      [path.join("app", "identidad.ts")]: "identidad de prueba, justificada aqui",
    };

    expect(violaciones(tmp, excepcionesDePrueba)).toEqual([
      `${path.join("app", "forma-a.ts")}:1: compara el rol con un literal (forma A)`,
      `${path.join("app", "forma-a.ts")}:2: compara el rol con un literal (forma A)`,
      `${path.join("lib", "forma-b.ts")}:1: usa session.user.rol crudo sin rolDeVista (forma B)`,
      `${path.join("lib", "forma-b.ts")}:2: usa session.user.rol crudo sin rolDeVista (forma B)`,
      `${path.join("lib", "forma-b.ts")}:3: usa session.user.rol crudo sin rolDeVista (forma B)`,
    ]);
  });
});
