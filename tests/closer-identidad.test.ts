import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { claveDeCloser, claveDeCloserSql, igualCloser, mismoCloser, normalizarCloserId } from "@/lib/closers/identidad";
import { users } from "@/lib/db/schema";
import { crearBaseReutilizable, type BaseDePrueba } from "./helpers/base-de-prueba";

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
    base = await crearBaseReutilizable();
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
