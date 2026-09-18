import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { sql } from "drizzle-orm";
import { claveDeCloser, claveDeCloserSql, igualCloser, mismoCloser, normalizarCloserId } from "@/lib/closers/identidad";
import { users } from "@/lib/db/schema";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";

/**
 * ADR 0030 — `Mani` y `mani` son el MISMO closer.
 *
 * Por que hace falta un test y no basta con cuidado: comparar el texto en crudo
 * **no lanza ningun error**. El comparativo entre closers muestra dos filas en vez
 * de una, el filtro por closer devuelve la mitad de sus llamadas, y las dos cifras
 * se ven perfectamente creibles. Es la misma familia del centinela del ano 1 y de
 * la subconsulta correlacionada del ticket 025: numeros callados que estan mal.
 */

describe("normalizarCloserId", () => {
  it("ignora mayusculas, bordes y espacios internos repetidos", () => {
    expect(normalizarCloserId("Mani")).toBe("mani");
    expect(normalizarCloserId("  MANI  ")).toBe("mani");
    expect(normalizarCloserId("Juan  Jose")).toBe("juan jose");
    expect(normalizarCloserId("\tAndrea\n")).toBe("andrea");
  });

  it("trata el vacio como 'sin closer'", () => {
    expect(normalizarCloserId("")).toBeNull();
    expect(normalizarCloserId("   ")).toBeNull();
    expect(normalizarCloserId(null)).toBeNull();
    expect(normalizarCloserId(undefined)).toBeNull();
  });

  /**
   * El regex colapsa ESPACIOS, no letras. Se prueba explicitamente porque la primera
   * version usaba `'\\s+'` dentro de un template literal de JS, que se cocina a
   * `'s+'`: el regex habria colapsado las eses y `Jose` se habria normalizado a
   * `jo e`. Con una clase POSIX no hay nada que cocinar.
   */
  it("no toca las letras (la trampa del escape cocinado)", () => {
    expect(normalizarCloserId("Jose")).toBe("jose");
    expect(normalizarCloserId("Vanessa")).toBe("vanessa");
    expect(normalizarCloserId("SS")).toBe("ss");
  });
});

describe("mismoCloser", () => {
  it("dice que si cuando solo cambian mayusculas o espacios", () => {
    expect(mismoCloser("Mani", "mani")).toBe(true);
    expect(mismoCloser("Andrea", " ANDREA ")).toBe(true);
    expect(mismoCloser("Juan  Jose", "juan jose")).toBe(true);
  });

  it("dice que no cuando son closers distintos", () => {
    expect(mismoCloser("Mani", "Maru")).toBe(false);
    expect(mismoCloser("Andrea", "Andre")).toBe(false);
  });

  it("dos 'sin closer' son la misma clave de agrupacion", () => {
    expect(mismoCloser(null, "")).toBe(true);
    expect(claveDeCloser(null)).toBe(claveDeCloser("   "));
  });

  it("'sin closer' nunca es un closer con nombre", () => {
    expect(mismoCloser(null, "Mani")).toBe(false);
    expect(claveDeCloser(null)).not.toBe(claveDeCloser("Mani"));
  });
});

describe("la normalizacion de SQL y la de memoria no pueden divergir", () => {
  let base: BaseDePrueba;
  beforeAll(async () => {
    base = await crearBaseDePrueba();
  });
  afterAll(async () => {
    await base?.cerrar();
  });

  /**
   * El riesgo real: `claveDeCloserSql` corre en Postgres y `normalizarCloserId` en
   * JavaScript. Si dejan de dar lo mismo, el indice unico deja de proteger lo que
   * la consulta agrupa, y otra vez sin ningun error. Se comprueba contra el motor,
   * no leyendo los dos textos.
   */
  it("Postgres normaliza igual que JavaScript", async () => {
    const casos = ["Mani", "  MANI  ", "Juan  Jose", "Jose", "Vanessa", "Andrea", "SS", "a  b  c"];
    for (const caso of casos) {
      const resultado = await base.db.execute(
        sql`select ${claveDeCloserSql(sql`${caso}`)} as clave`,
      );
      const filas = (Array.isArray(resultado) ? resultado : resultado.rows) as { clave: string }[];
      expect(filas[0]!.clave, `Postgres y JS difieren para ${JSON.stringify(caso)}`).toBe(
        normalizarCloserId(caso),
      );
    }
  });

  it("el indice unico impide dos cuentas reclamando el mismo closer", async () => {
    await base.db.insert(users).values({ email: "uno@retia.test", rol: "closer", closerId: "Andrea" });

    await expect(
      base.db.insert(users).values({ email: "dos@retia.test", rol: "closer", closerId: "andrea" }),
    ).rejects.toThrow();

    // Y con espacios de sobra tampoco se cuela.
    await expect(
      base.db.insert(users).values({ email: "tres@retia.test", rol: "closer", closerId: "  ANDREA " }),
    ).rejects.toThrow();
  });

  it("varios usuarios sin closerId conviven (el indice es parcial)", async () => {
    await base.db.insert(users).values({ email: "g1@retia.test", rol: "gerente", closerId: null });
    await base.db.insert(users).values({ email: "g2@retia.test", rol: "gerente", closerId: null });
    const filas = await base.db.select().from(users);
    expect(filas.filter((u) => u.closerId === null).length).toBeGreaterThanOrEqual(2);
  });

  it("igualCloser encuentra la fila aunque cambien las mayusculas", async () => {
    const filas = await base.db.select().from(users).where(igualCloser(users.closerId, "ANDREA"));
    expect(filas).toHaveLength(1);
    expect(filas[0]!.closerId).toBe("Andrea");
  });
});

/**
 * Guardian: nadie vuelve a comparar `closerId` en crudo.
 *
 * Mismo molde que `tests/vigencia-centralizada.test.ts` y el guardian de slugs: la
 * regla se verifica sobre el arbol real en vez de confiar en que quien escriba la
 * proxima consulta se acuerde.
 */
describe("guardian: la identidad de un closer se pregunta por el modulo", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));
  const DIRECTORIOS = ["lib", "app", "components"];
  const EXTENSIONES = new Set([".ts", ".tsx"]);
  /** El unico modulo autorizado a saber como se compara un closerId. */
  const MODULO = path.join("lib", "closers", "identidad.ts");

  function archivos(dir: string): string[] {
    const abs = path.join(RAIZ, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) return archivos(rel);
      return EXTENSIONES.has(path.extname(e.name)) ? [rel] : [];
    });
  }

  /** Quita comentarios para no marcar un `eq(users.closerId, x)` citado en una nota. */
  function sinComentarios(codigo: string): string {
    return codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  }

  /**
   * Borra las formas AUTORIZADAS antes de buscar las prohibidas.
   *
   * Sin este paso el guardian marca su propio arreglo: `groupBy(claveDeCloserSql(
   * calls.closerId))` es exactamente lo que el ADR pide y contiene el texto
   * `.closerId` dentro de un `groupBy`. Un guardian que castiga la solucion empuja a
   * escribir la version mala o a poner una excepcion por archivo, que es donde se
   * esconde lo que no caza (leccion del ticket 028).
   */
  function sinFormasAutorizadas(codigo: string): string {
    return codigo
      .replace(/claveDeCloserSql\(\s*[\w.]+\s*\)/g, "CLAVE_NORMALIZADA")
      .replace(/igualCloser\(\s*[\w.]+\s*,/g, "IGUAL_NORMALIZADO(");
  }

  /**
   * Las formas que significan "comparo la identidad de un closer": un `eq(...)` de
   * drizzle sobre una columna de closer, un `groupBy` por esa columna, o una
   * comparacion estricta de JavaScript entre dos cosas que se llaman closerId.
   */
  const PROHIBIDO: { nombre: string; re: RegExp }[] = [
    { nombre: "eq() sobre una columna de closer", re: /\beq\(\s*\w+\.(closerId|responsableCloserId)\b/ },
    { nombre: "groupBy por una columna de closer", re: /\bgroupBy\([^)]*\.(closerId|responsableCloserId)\b/ },
    { nombre: "comparacion estricta de closerId", re: /\.(closerId|responsableCloserId)\s*[!=]==\s*/ },
    { nombre: "comparacion estricta contra closerId", re: /[!=]==\s*\w+\.(closerId|responsableCloserId)\b/ },
  ];

  it("ningun archivo compara un closerId en crudo", () => {
    const hallazgos: string[] = [];
    for (const dir of DIRECTORIOS) {
      for (const rel of archivos(dir)) {
        if (rel === MODULO) continue;
        const codigo = sinFormasAutorizadas(sinComentarios(fs.readFileSync(path.join(RAIZ, rel), "utf8")));
        codigo.split("\n").forEach((linea, i) => {
          for (const { nombre, re } of PROHIBIDO) {
            if (re.test(linea)) hallazgos.push(`${rel}:${i + 1} — ${nombre}: ${linea.trim()}`);
          }
        });
      }
    }
    expect(hallazgos, `Usa lib/closers/identidad.ts (ADR 0030):\n${hallazgos.join("\n")}`).toEqual([]);
  });

  /**
   * Un guardian que no se prueba mordiendo es confianza falsa (leccion del ticket
   * 028). Se comprueba que las cuatro formas prohibidas SI se detectan.
   */
  it("el detector no es trivial: caza las cuatro formas", () => {
    const mordidas = [
      "    .where(eq(users.closerId, closerId))",
      "      .groupBy(calls.closerId),",
      "  if (objetivo.closerId !== closerId) {",
      "  if (datos.responsableCloserId === persona.responsableCloserId) {",
    ];
    for (const linea of mordidas) {
      expect(
        PROHIBIDO.some(({ re }) => re.test(sinFormasAutorizadas(linea))),
        `no cazo: ${linea}`,
      ).toBe(true);
    }
  });

  /** Y la otra mitad: las formas correctas NO se marcan. */
  it("el detector no castiga la solucion", () => {
    const correctas = [
      "      .groupBy(claveDeCloserSql(calls.closerId)),",
      "      .groupBy(claveDeCloserSql(abonos.closerId), abonos.moneda),",
      "        igualCloser(users.closerId, closerId),",
      "      if (!mismoCloser(datos.closerId, actor.closerId)) {",
      "        closerId: sql<string | null>`min(${calls.closerId})`,",
    ];
    for (const linea of correctas) {
      const limpia = sinFormasAutorizadas(linea);
      expect(
        PROHIBIDO.filter(({ re }) => re.test(limpia)).map((x) => x.nombre),
        `marco de mas: ${linea}`,
      ).toEqual([]);
    }
  });
});
