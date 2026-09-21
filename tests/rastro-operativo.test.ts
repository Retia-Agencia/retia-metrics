import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import { changeLog, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { crearConRastro, editarConRastro } from "@/lib/crm/rastro";

/**
 * ADR 0042 (D6) — **toda escritura del CRM deja rastro, desde el dia uno**.
 *
 * Dos mitades, y las dos hacen falta:
 *  - el COMPORTAMIENTO de `lib/crm/rastro.ts`: la escritura y su bitacora en la
 *    misma operacion, el actor de la sesion y no del input, y nada escrito cuando
 *    nada cambio;
 *  - el GUARDIAN: que nadie escriba esas cuatro tablas por fuera.
 *
 * 🩸 Por que el guardian y no cuidado al escribir: **omitir un rastro no lanza
 * ningun error.** Los 5 enlaces de PayPal entraron a `production` el 18-sep con
 * `change_log` en 0 y siguen sin rastro a proposito, porque un historial de
 * auditoria fabricado se ve identico al de verdad.
 *
 * Y por que va en la etapa 1, antes de que exista una sola mutacion que vigilar:
 * un guardian que llega despues obliga a auditar a mano todo lo escrito en el
 * intervalo. Es el mismo argumento del ADR 0029.
 */

const RAIZ = fileURLToPath(new URL("../", import.meta.url));

/** Los nombres de drizzle de las cuatro tablas operativas. */
const TABLAS_VIGILADAS = ["deals", "calls", "abonos", "dealActividades"] as const;

/** El unico modulo autorizado a escribirlas. */
const MODULO_AUTORIZADO = path.join("lib", "crm", "rastro.ts");

/** Todo el codigo de la app. `tests/` queda fuera: es quien prueba la regla. */
const DIRECTORIOS = ["lib", "app", "components", "scripts"];

const EXTENSIONES = new Set([".ts", ".tsx"]);

/**
 * Excepciones explicitas, por ruta relativa. HOY ESTA VACIA A PROPOSITO.
 *
 * Sembrar una base VACIA (`seed:datos`) es la excepcion nombrada del ADR 0029, pero
 * el seed **no escribe ninguna de estas cuatro tablas**: siembra programas, cohortes
 * y fuentes. Si algun dia lo hiciera, entra aqui con su razon escrita.
 */
const EXCEPCIONES: readonly string[] = [];

/**
 * Reemplaza comentarios y cadenas por espacios, conservando los saltos de linea.
 * Este repo comenta en espanol y las palabras "deals", "calls" y "abonos" aparecen
 * en prosa por todas partes; un guardian que grita por un comentario se apaga a la
 * tercera falsa alarma.
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
      if (c === "\n") { estado = "codigo"; salida.push("\n"); } else salida.push(" ");
      i += 1; continue;
    }
    if (estado === "bloque") {
      if (par === "*/") { estado = "codigo"; salida.push(" ", " "); i += 2; continue; }
      salida.push(blanco(c)); i += 1; continue;
    }
    // Cadenas: se vacian enteras. Dentro de un template `sql` no hay escrituras,
    // solo lecturas, asi que aqui no se pierde nada (a diferencia del guardian de
    // vigencia, que si tiene que mirar adentro).
    if (c === "\\") { salida.push(" ", " "); i += 2; continue; }
    if ((estado === "simple" && c === "'") ||
        (estado === "doble" && c === '"') ||
        (estado === "template" && c === "`")) {
      estado = "codigo"; salida.push(" "); i += 1; continue;
    }
    salida.push(blanco(c)); i += 1; continue;
  }
  return salida.join("");
}

function archivos(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : archivos(completo);
    return EXTENSIONES.has(path.extname(e.name)) ? [completo] : [];
  });
}

/** `.insert(deals)` / `.update(calls)` / … fuera del modulo autorizado. */
function escriturasSinRastro(raiz: string): string[] {
  const patron = new RegExp(
    `\\.(insert|update)\\(\\s*(${TABLAS_VIGILADAS.join("|")})\\s*[),]`,
    "g",
  );
  const hallazgos: string[] = [];

  for (const dir of DIRECTORIOS) {
    for (const archivo of archivos(path.join(raiz, dir))) {
      const relativo = path.relative(raiz, archivo);
      if (relativo === MODULO_AUTORIZADO || EXCEPCIONES.includes(relativo)) continue;

      const limpio = limpiar(fs.readFileSync(archivo, "utf8"));
      for (const m of limpio.matchAll(patron)) {
        const linea = limpio.slice(0, m.index).split("\n").length;
        hallazgos.push(`${relativo}:${linea}: ${m[1]} sobre '${m[2]}' fuera de ${MODULO_AUTORIZADO}`);
      }
    }
  }
  return hallazgos.sort();
}

describe("el rastro de las tablas operativas (ADR 0042)", () => {
  it("ninguna escritura sobre deals, calls, abonos o deal_actividades ocurre fuera del modulo", () => {
    const violaciones = escriturasSinRastro(RAIZ);
    expect(
      violaciones,
      `El ADR 0042 exige que toda escritura del CRM deje su fila de change_log en la ` +
        `misma operacion. Omitir un rastro NO lanza ningun error:\n${violaciones.join("\n")}`,
    ).toEqual([]);
  });

  // El detector, mordido en los dos sentidos sobre un arbol temporal controlado.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "rastro-"));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("caza el insert clandestino y NO marca ni la prosa ni al modulo autorizado", () => {
    const dir = path.join(tmp, "lib", "mutations");
    fs.mkdirSync(dir, { recursive: true });

    // Sucio: escribe directo. Es EL caso que este guardian existe para atrapar.
    fs.writeFileSync(
      path.join(dir, "sucio.ts"),
      [
        "export async function cerrar(db: Db, id: string) {",
        "  await db.update(deals).set({ productoId: p }).where(eq(deals.id, id));",
        "  await db.insert(abonos).values({ dealId: id, monto: m });",
        "}",
      ].join("\n"),
    );

    // Limpio: pasa por el modulo. No puede aparecer.
    fs.writeFileSync(
      path.join(dir, "limpio.ts"),
      [
        "export async function registrar(db: Db, actorId: string) {",
        "  return crearConRastro(",
        "    { db, tabla: abonos, nombreTabla: 'abonos', actorId, etiqueta: 'abono' },",
        "    { dealId: d, monto: m },",
        "  );",
        "}",
      ].join("\n"),
    );

    // Ruido: prosa, una cadena y una LECTURA. Ninguna es una escritura.
    fs.writeFileSync(
      path.join(dir, "ruido.ts"),
      [
        "// Aqui no se hace insert(deals) ni update(calls): solo se leen.",
        "/* update(abonos) en un comentario tampoco cuenta. */",
        "export const NOTA = 'no hagas insert(deals) a mano';",
        "export const leer = (db: Db) => db.select().from(deals).where(vigente(deals));",
      ].join("\n"),
    );

    // El modulo autorizado, en su ruta real: sus escrituras son las legitimas.
    const dirAutorizado = path.join(tmp, "lib", "crm");
    fs.mkdirSync(dirAutorizado, { recursive: true });
    fs.writeFileSync(
      path.join(dirAutorizado, "rastro.ts"),
      "export const escribir = (db: Db) => db.insert(deals).values(v);\n",
    );

    expect(escriturasSinRastro(tmp)).toEqual([
      `${path.join("lib", "mutations", "sucio.ts")}:3: insert sobre 'abonos' fuera de ${MODULO_AUTORIZADO}`,
      `${path.join("lib", "mutations", "sucio.ts")}:2: update sobre 'deals' fuera de ${MODULO_AUTORIZADO}`,
    ].sort());
  });
});

describe("crearConRastro y editarConRastro", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programaA: string;
  let leadA: string;
  let gerente: string;

  beforeEach(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [p] = await db
      .insert(programs)
      .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
      .returning();
    programaA = p.id;
    const [l] = await db
      .insert(leads)
      .values({ programId: programaA, emailNormalizado: "ana@correo.co" })
      .returning();
    leadA = l.id;
    const [u] = await db
      .insert(users)
      .values({ email: "gerente@retiagrowth.com", rol: "gerente" })
      .returning();
    gerente = u.id;
  }, 60_000);

  afterEach(async () => {
    await cerrar();
  });

  const ctx = () => ({
    db,
    tabla: deals,
    nombreTabla: "deals" as const,
    actorId: gerente,
    etiqueta: "Ana · Programa A",
  });

  it("crear escribe la fila y una linea de bitacora por campo, con el actor", async () => {
    const id = await crearConRastro(ctx(), { leadId: leadA, programId: programaA });

    expect(await db.select().from(deals).where(eq(deals.id, id))).toHaveLength(1);

    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, id));
    expect(log.map((l) => l.campo).sort()).toEqual(["leadId", "programId"]);
    expect(log.every((l) => l.tabla === "deals")).toBe(true);
    expect(log.every((l) => l.userId === gerente)).toBe(true);
    expect(log.every((l) => l.origen === "app")).toBe(true);
    expect(log.every((l) => l.etiqueta === "Ana · Programa A")).toBe(true);
  });

  it("lo que llega vacio no se registra: un nulo no es un cambio", async () => {
    const id = await crearConRastro(ctx(), {
      leadId: leadA,
      programId: programaA,
      ownerUserId: null,
      onboardedAt: null,
    });

    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, id));
    expect(log.map((l) => l.campo).sort()).toEqual(["leadId", "programId"]);
  });

  it("editar registra SOLO el campo tocado, con su valor anterior y el nuevo", async () => {
    const id = await crearConRastro(ctx(), { leadId: leadA, programId: programaA });
    await db.delete(changeLog);

    const cambio = await editarConRastro(ctx(), id, { ownerUserId: gerente });

    expect(cambio).toBe(true);
    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, id));
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({
      campo: "ownerUserId",
      valorAnterior: null,
      valorNuevo: gerente,
    });
  });

  it("si nada cambio no se toca la fila ni se escribe bitacora", async () => {
    const id = await crearConRastro(ctx(), { leadId: leadA, programId: programaA });
    await db.delete(changeLog);

    const cambio = await editarConRastro(ctx(), id, { programId: programaA });

    expect(cambio).toBe(false);
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("🎯 un actor metido en los VALORES se ignora: el quien sale de la sesion", async () => {
    // La misma prueba del ticket 031. `creadoPor` es una columna real del deal, asi
    // que un cliente malicioso podria mandarla en el cuerpo; lo que NO puede es
    // cambiar quien firma la bitacora, porque el `userId` del rastro sale del
    // `actorId` del contexto y este modulo nunca mira los valores para sacarlo.
    const [otro] = await db
      .insert(users)
      .values({ email: "otro@retiagrowth.com", rol: "closer", closerId: "Otro" })
      .returning();

    const id = await crearConRastro(ctx(), {
      leadId: leadA,
      programId: programaA,
      creadoPor: otro.id,
    });

    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, id));
    expect(log.every((l) => l.userId === gerente)).toBe(true);
  });

  it("el rastro del sync no tiene usuario, y eso es un dato, no un hueco", async () => {
    const id = await crearConRastro(
      { ...ctx(), actorId: null },
      { leadId: leadA, programId: programaA },
    );

    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, id));
    expect(log.every((l) => l.userId === null)).toBe(true);
  });
});
