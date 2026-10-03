import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { eq } from "drizzle-orm";
import {
  miembrosPrograma,
  leads,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";
import {
  idsDeProgramasVisibles,
  programaEnAlcance,
  programaVisiblePorSlug,
  programasVisibles,
} from "@/lib/auth/alcance";
import { buscarLeads } from "@/lib/queries/leads";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * ADR 0048 punto 1 / ticket 094 — "¿qué programas ve esta sesión?" tiene UNA sola
 * respuesta, en `lib/auth/alcance.ts`, y toda lectura con programa la usa.
 *
 * DOS piezas que se prueban juntas:
 *
 *  1. La función de alcance y sus consumidores contra PGlite: un closer de un solo
 *     programa no ve el otro (ni en el selector, ni en el buscador, ni en una ficha
 *     abierta por id), y gerente y developer ven todo. Se afirma leyendo lo que
 *     devuelve la interfaz pública, no mirando que un ítem no aparezca.
 *
 *  2. Un GUARDIÁN sobre `lib/` y `app/`: ninguna lectura filtra por membresía
 *     (`miembrosPrograma` / `miembros_programa`) por su cuenta en vez de llamar a la
 *     función de alcance. Cada copia de ese join es una frontera que alguien puede
 *     olvidar cerrar; el programa es una frontera, no un filtro (AGENTS.md). Mismo
 *     molde que `tests/closer-identidad.test.ts` y `tests/vigencia-centralizada.test.ts`:
 *     análisis de texto sobre el árbol real, con excepciones nombradas y probado
 *     mordiendo en los dos sentidos.
 */

// ─────────────────────────────────────────────────────────── la función y sus usos

describe("la función de alcance (ADR 0048, ticket 094)", () => {
  let base: BaseDePrueba;
  let db: Db;

  let anaUserId: string;
  let gerenteId: string;
  let devId: string;
  let programaA: string;
  let programaB: string;
  let slugA: string;
  let slugB: string;

  beforeAll(async () => {
    base = await crearBaseDePrueba();
    db = base.db;

    const [ana] = await db
      .insert(users)
      .values({ email: "ana@retiagrowth.com", rol: "closer", nombre: "Ana", closerId: "Ana" })
      .returning();
    anaUserId = ana.id;

    const [g] = await db
      .insert(users)
      .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
      .returning();
    gerenteId = g.id;

    const [d] = await db
      .insert(users)
      .values({ email: "dev@retiagrowth.com", rol: "developer", nombre: "Dev" })
      .returning();
    devId = d.id;

    const [a] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
      .returning();
    programaA = a.id;
    slugA = a.slug;

    const [b] = await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1500.00" })
      .returning();
    programaB = b.id;
    slugB = b.slug;

    // Ana es miembro ACTIVA solo de A.
    await db.insert(miembrosPrograma).values({ userId: anaUserId, programId: programaA, activo: true });
  }, 60_000);

  afterAll(async () => {
    await base?.cerrar();
  });

  it("un closer ve SOLO los programas donde tiene membresía activa", async () => {
    const vistos = await programasVisibles(anaUserId, "closer", db);
    expect(vistos).toHaveLength(1);
    expect(vistos[0]!.id).toBe(programaA);
    expect(vistos[0]!.slug).toBe(slugA);
  });

  it("un gerente ve TODOS los programas activos, sin membresías", async () => {
    const vistos = await programasVisibles(gerenteId, "gerente", db);
    expect(vistos.map((p) => p.id).sort()).toEqual([programaA, programaB].sort());
  });

  it("un developer también ve todos: no se le restringe nada (ADR 0025 punto 5)", async () => {
    const vistos = await programasVisibles(devId, "developer", db);
    expect(vistos.map((p) => p.id).sort()).toEqual([programaA, programaB].sort());
  });

  it("una membresía INACTIVA no cuenta", async () => {
    await db.insert(miembrosPrograma).values({ userId: anaUserId, programId: programaB, activo: false });
    const vistos = await programasVisibles(anaUserId, "closer", db);
    expect(vistos.map((p) => p.id)).toEqual([programaA]);
    // Limpieza para no contaminar los demás casos.
    await db.delete(miembrosPrograma).where(eq(miembrosPrograma.programId, programaB));
  });

  it("un programa INACTIVO no sale, ni para quien administra", async () => {
    await db.update(programs).set({ activo: false }).where(eq(programs.id, programaB));
    expect((await programasVisibles(gerenteId, "gerente", db)).map((p) => p.id)).toEqual([programaA]);
    await db.update(programs).set({ activo: true }).where(eq(programs.id, programaB));
  });

  it("idsDeProgramasVisibles devuelve un Set de ids", async () => {
    const ids = await idsDeProgramasVisibles(anaUserId, "closer", db);
    expect(ids.has(programaA)).toBe(true);
    expect(ids.has(programaB)).toBe(false);
    expect(ids.size).toBe(1);
  });

  it("programaVisiblePorSlug: el propio se resuelve, el ajeno es null (404, no 403)", async () => {
    expect((await programaVisiblePorSlug(anaUserId, "closer", slugA, db))?.id).toBe(programaA);
    // El programa ajeno EXISTE, pero para este closer es indistinguible de uno
    // inexistente: null, para que la ruta responda 404 y no filtre que slugs existen.
    expect(await programaVisiblePorSlug(anaUserId, "closer", slugB, db)).toBeNull();
    // Un slug que no existe también es null.
    expect(await programaVisiblePorSlug(anaUserId, "closer", "no-existe", db)).toBeNull();
    // El gerente sí ve el ajeno.
    expect((await programaVisiblePorSlug(gerenteId, "gerente", slugB, db))?.id).toBe(programaB);
  });

  it("programaEnAlcance: true para el propio, false para el ajeno", async () => {
    expect(await programaEnAlcance(anaUserId, "closer", programaA, db)).toBe(true);
    expect(await programaEnAlcance(anaUserId, "closer", programaB, db)).toBe(false);
    expect(await programaEnAlcance(gerenteId, "gerente", programaB, db)).toBe(true);
  });

  it("buscarLeads queda acotado al programa recibido", async () => {
    const [pa] = await db
      .insert(leads)
      .values({ programId: programaA, emailNormalizado: "persona-a@correo.co", nombre: "Persona A" })
      .returning();
    const [pb] = await db
      .insert(leads)
      .values({ programId: programaB, emailNormalizado: "persona-b@correo.co", nombre: "Persona B" })
      .returning();

    expect((await buscarLeads(db, programaA, "Persona")).map((r) => r.id)).toEqual([pa.id]);
    expect((await buscarLeads(db, programaB, "Persona")).map((r) => r.id)).toEqual([pb.id]);

    await db.delete(leads).where(eq(leads.id, pa.id));
    await db.delete(leads).where(eq(leads.id, pb.id));
  });
});

// ─────────────────────────────────────────────────────────── el guardián

describe("guardián: el alcance se pregunta por la función, no con un join propio", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));
  const DIRECTORIOS = ["lib", "app"];
  const EXTENSIONES = new Set([".ts", ".tsx"]);

  /** Los dos nombres con los que una consulta toca la tabla de membresías. */
  const MEMBRESIA = /\bmiembrosPrograma\b|\bmiembros_programa\b/;

  /**
   * Los ÚNICOS lugares donde tocar `miembros_programa` a mano es legítimo, cada uno
   * nombrado con su justificación. Todos comparten el fundamento: NO son una lectura
   * que se limita al alcance de una sesión, sino la definición del alcance misma o el
   * lado de ESCRITURA (administrar membresías, o "¿este actor puede tocar esta fila?").
   */
  const EXCEPCIONES: Record<string, string> = {
    // La DEFINICIÓN de la TABLA: el esquema declara `miembros_programa`. No es una
    // consulta, es la tabla misma; sin ella no habría membresía que consultar.
    [path.join("lib", "db", "schema.ts")]:
      "la definición de la tabla miembros_programa, no una consulta",

    // La DEFINICIÓN del alcance: la función de alcance ES la que consulta la
    // membresía. Si contara como violación, la regla se mordería la cola.
    [path.join("lib", "auth", "alcance.ts")]:
      "la definición misma: la función de alcance consulta miembros_programa",

    // El lado de ESCRITURA nombrado por el ticket 094: "¿este actor puede tocar una
    // fila de ESTE programa?" (ADR 0016). No limita una lectura al alcance; autoriza
    // una escritura contra la base.
    [path.join("lib", "catalogo", "acceso-programa.ts")]:
      "write-side: exigirAccesoAlPrograma autoriza una escritura, no limita una lectura",

    // Administración de las membresías: sincroniza `miembros_programa` de un usuario
    // (activa/inserta/desactiva). Es el CRUD de la propia tabla, no una lectura acotada.
    [path.join("lib", "catalogo", "usuarios.ts")]:
      "write-side: administra las membresías (las crea, activa y desactiva)",

    // La identidad de la host de una cita (ticket 096): "¿qué closer del programa es
    // dueña de esta cuenta de Calendly?". No acota ninguna lectura a una sesión: decide
    // de quién es un deal, y no hay sesión (lo llama el sistema).
    [path.join("lib", "calendly", "colgar-llamada.ts")]:
      "identidad de la host: qué closer es dueña de una cuenta de Calendly en el programa",

    // "¿Quién puede ser dueño de un deal de este programa?" (ticket 074): decide de quién
    // puede ser una fila, para la lista de reasignar y para la reja de editarDeal. No acota
    // ninguna lectura a una sesión.
    [path.join("lib", "deals", "duenos.ts")]:
      "identidad del dueño: quién puede ser dueño de un deal del programa",

    // Mutación: al crear/asignar una persona comprueba que el actor sea miembro activo
    // del programa. Es autorización de escritura, misma familia que acceso-programa.
    [path.join("lib", "mutations", "personas.ts")]:
      "write-side: la mutación verifica que el actor sea miembro antes de escribir",

    // `programasGestionablesPorUsuario` responde "¿qué programas puede EDITAR este
    // usuario?" (ADR 0016), el alcance de escritura de /recursos, que el
    // ticket 094 deja explícitamente FUERA (eso ya lo contesta exigirAccesoAlPrograma).
    [path.join("lib", "queries", "programas.ts")]:
      "write-side: programasGestionablesPorUsuario es el alcance de EDICIÓN, no de lectura (fuera del 094)",
  };

  /**
   * Borra comentarios y cadenas conservando los saltos de línea (para reportar la
   * línea correcta). Necesario porque este repo comenta en español y `miembros_programa`
   * aparece en la prosa de varios módulos (incluido el nuevo comentario de personas.ts).
   * Copiado en espíritu de `tests/rol-de-vista-centralizado.test.ts`.
   */
  function limpiar(fuente: string): string {
    const salida: string[] = [];
    let estado: "codigo" | "linea" | "bloque" | "simple" | "doble" | "template" = "codigo";
    let i = 0;
    const blanco = (c: string) => (c === "\n" ? "\n" : " ");
    while (i < fuente.length) {
      const c = fuente[i]!;
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
      // template
      if (c === "\\") { salida.push(" ", " "); i += 2; continue; }
      if (c === "`") estado = "codigo";
      salida.push(blanco(c)); i += 1;
    }
    return salida.join("");
  }

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
   * Recorre `lib/` y `app/` y devuelve las violaciones: código que toca
   * `miembros_programa` fuera de las excepciones nombradas. El mapa de excepciones se
   * pasa aparte para poder probar el detector sobre un árbol de mentira.
   */
  function violaciones(raiz: string, excepciones: Record<string, string>): string[] {
    const fuera: string[] = [];
    for (const dir of DIRECTORIOS) {
      for (const archivo of archivosDeCodigo(path.join(raiz, dir))) {
        const ruta = path.relative(raiz, archivo);
        if (ruta in excepciones) continue;
        const limpio = limpiar(fs.readFileSync(archivo, "utf8"));
        limpio.split("\n").forEach((linea, i) => {
          if (MEMBRESIA.test(linea)) {
            fuera.push(`${ruta}:${i + 1}: filtra por membresía a mano; usa lib/auth/alcance.ts`);
          }
        });
      }
    }
    return fuera.sort();
  }

  it("la función de alcance existe en lib/auth/alcance.ts", async () => {
    const modulo = (await import("@/lib/auth/alcance")) as Record<string, unknown>;
    expect(typeof modulo.programasVisibles).toBe("function");
    expect(typeof modulo.idsDeProgramasVisibles).toBe("function");
    expect(typeof modulo.programaVisiblePorSlug).toBe("function");
    expect(typeof modulo.programaEnAlcance).toBe("function");
  });

  it("ninguna lectura en lib/ ni app/ filtra por membresía por su cuenta (salvo excepciones nombradas)", () => {
    const fuera = violaciones(RAIZ, EXCEPCIONES);
    expect(
      fuera,
      `El ticket 094 exige que el alcance se pregunte con lib/auth/alcance.ts, no con ` +
        `un join propio a miembros_programa. Arréglalo importando programasVisibles / ` +
        `idsDeProgramasVisibles / programaEnAlcance, o si es un uso legítimo de ` +
        `escritura agrégalo a EXCEPCIONES con su justificación:\n${fuera.join("\n")}`,
    ).toEqual([]);
  });

  it("las excepciones nombradas existen y están justificadas", () => {
    for (const [ruta, motivo] of Object.entries(EXCEPCIONES)) {
      expect(fs.existsSync(path.join(RAIZ, ruta)), `la excepción ${ruta} ya no existe`).toBe(true);
      expect(motivo.length, `la excepción ${ruta} necesita justificación`).toBeGreaterThan(10);
    }
  });

  // Prueba de que el detector no es trivial: muerde en los dos sentidos sobre un árbol
  // temporal. Caza el join a mano, respeta la función de alcance, respeta la excepción
  // y no grita por la prosa que menciona miembros_programa en un comentario o cadena.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "alcance-"));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it("el detector caza un join a mano y NO castiga la solución (muerde en los dos sentidos)", () => {
    const lib = path.join(tmp, "lib");
    const app = path.join(tmp, "app");
    fs.mkdirSync(lib, { recursive: true });
    fs.mkdirSync(app, { recursive: true });

    // MALO: una lectura que arma su propio join a la membresía.
    fs.writeFileSync(
      path.join(app, "malo.ts"),
      [
        "const filas = await db",
        "  .select({ id: leads.id })",
        "  .from(leads)",
        "  .innerJoin(miembrosPrograma, eq(miembrosPrograma.programId, leads.programId))",
        "  .where(eq(miembrosPrograma.userId, userId));",
      ].join("\n"),
    );

    // MALO también: la tabla mencionada en una condición suelta (identificador de
    // drizzle, no una cadena). El guardián busca el identificador `miembrosPrograma`,
    // que es como este repo toca la tabla —nunca por su nombre en SQL crudo—.
    fs.writeFileSync(
      path.join(lib, "malo-condicion.ts"),
      ["const cond = eq(miembrosPrograma.userId, userId);"].join("\n"),
    );

    // BUENO: usa la función de alcance. No menciona la tabla en el código.
    fs.writeFileSync(
      path.join(lib, "bueno.ts"),
      [
        "const ids = await idsDeProgramasVisibles(userId, rol, db);",
        "return db.select().from(leads).where(inArray(leads.programId, [...ids]));",
      ].join("\n"),
    );

    // PROSA: menciona miembros_programa en un comentario y en una cadena. No es código.
    fs.writeFileSync(
      path.join(lib, "prosa.ts"),
      [
        "// antes esto hacía un join a miembrosPrograma; ahora usa el alcance",
        'const MSG = "el filtro de miembros_programa se centralizó";',
      ].join("\n"),
    );

    // Una excepción de mentira: sin ella, este archivo gritaría.
    fs.writeFileSync(
      path.join(lib, "excepcion.ts"),
      ["await db.select().from(miembrosPrograma).where(eq(miembrosPrograma.userId, id));"].join("\n"),
    );

    const excepcionesDePrueba = {
      [path.join("lib", "excepcion.ts")]: "excepción de prueba, justificada aquí",
    };

    expect(violaciones(tmp, excepcionesDePrueba)).toEqual([
      `${path.join("app", "malo.ts")}:4: filtra por membresía a mano; usa lib/auth/alcance.ts`,
      `${path.join("app", "malo.ts")}:5: filtra por membresía a mano; usa lib/auth/alcance.ts`,
      `${path.join("lib", "malo-condicion.ts")}:1: filtra por membresía a mano; usa lib/auth/alcance.ts`,
    ]);
  });
});
