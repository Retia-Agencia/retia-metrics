import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  categoriasRecurso,
  plataformasPago,
  productos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { crearRecurso, reemplazarRecurso } from "@/lib/catalogo/recursos";
import { crearEnlacePago } from "@/lib/catalogo/enlaces-pago";
import {
  enlacesDePagoVigentes,
  historialDeRecurso,
  historialesDeRecursos,
  recursosVigentes,
} from "@/lib/queries/recursos";

/**
 * Ticket 023: las lecturas de la pantalla `/recursos`. El molde del 022 devuelve
 * filas sin joins; la pantalla necesita el nombre de la categoria y del programa ya
 * resueltos (nunca uuids), el filtro por programa que incluye los globales, la
 * busqueda por titulo, y el historial de versiones. Todo SELECT, sobre PGlite.
 */

let db: Db;
let cerrar: () => Promise<void>;
let userId: string;
let programaA: string;
let programaB: string;
let categoriaBrochure: string;
let categoriaGuion: string;
let plataforma: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());

  const [u] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  userId = u.id;

  const [a] = await db
    .insert(programs)
    .values({ slug: "comunicarte", nombre: "Comunicarte", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;
  const [b] = await db
    .insert(programs)
    .values({ slug: "tactical", nombre: "Tactical Investor", ticketUsd: "1500.00" })
    .returning();
  programaB = b.id;

  const [cb] = await db.insert(categoriasRecurso).values({ nombre: "Brochure" }).returning();
  categoriaBrochure = cb.id;
  const [cg] = await db.insert(categoriasRecurso).values({ nombre: "Guion" }).returning();
  categoriaGuion = cg.id;

  // PayPal ya viene sembrada por la migracion 0003; se reusa en vez de insertarla.
  const [pl] = await db
    .select()
    .from(plataformasPago)
    .where(eq(plataformasPago.nombre, "PayPal"));
  plataforma = pl.id;
});

afterEach(async () => {
  await cerrar();
});

describe("recursosVigentes — filtro por programa incluye los globales", () => {
  it("un filtro por programa trae los del programa Y los globales", async () => {
    await crearRecurso(db, userId, {
      programId: programaA,
      categoriaId: categoriaBrochure,
      titulo: "Brochure Comunicarte",
      url: "https://drive.google.com/comunicarte",
    });
    await crearRecurso(db, userId, {
      programId: programaB,
      categoriaId: categoriaBrochure,
      titulo: "Brochure Tactical",
      url: "https://drive.google.com/tactical",
    });
    await crearRecurso(db, userId, {
      programId: null,
      categoriaId: categoriaGuion,
      titulo: "Guion global",
      url: "https://drive.google.com/guion",
    });

    const filas = await recursosVigentes({ programId: programaA }, db);
    const titulos = filas.map((f) => f.titulo).sort();
    expect(titulos).toEqual(["Brochure Comunicarte", "Guion global"]);
    // No cuela el del otro programa.
    expect(titulos).not.toContain("Brochure Tactical");
  });

  it("sin filtro de programa trae todos, con el nombre de categoria y programa resueltos", async () => {
    await crearRecurso(db, userId, {
      programId: programaA,
      categoriaId: categoriaBrochure,
      titulo: "Brochure Comunicarte",
      url: "https://drive.google.com/comunicarte",
    });
    await crearRecurso(db, userId, {
      programId: null,
      categoriaId: categoriaGuion,
      titulo: "Guion global",
      url: "https://drive.google.com/guion",
    });

    const filas = await recursosVigentes({}, db);
    expect(filas).toHaveLength(2);
    const brochure = filas.find((f) => f.titulo === "Brochure Comunicarte")!;
    expect(brochure.categoriaNombre).toBe("Brochure");
    expect(brochure.programaNombre).toBe("Comunicarte");
    const global = filas.find((f) => f.titulo === "Guion global")!;
    expect(global.programaNombre).toBeNull();
  });

  it("la busqueda por titulo encuentra sin distinguir mayusculas", async () => {
    await crearRecurso(db, userId, {
      programId: programaA,
      categoriaId: categoriaBrochure,
      titulo: "Brochure Comunicarte",
      url: "https://drive.google.com/comunicarte",
    });
    await crearRecurso(db, userId, {
      programId: programaA,
      categoriaId: categoriaGuion,
      titulo: "Guion de ventas",
      url: "https://drive.google.com/guion",
    });

    const filas = await recursosVigentes({ q: "brochure" }, db);
    expect(filas.map((f) => f.titulo)).toEqual(["Brochure Comunicarte"]);
  });

  it("solo devuelve las versiones vigentes, no el historial", async () => {
    const creado = await crearRecurso(db, userId, {
      programId: programaA,
      categoriaId: categoriaBrochure,
      titulo: "Brochure",
      url: "https://drive.google.com/v1",
    });
    await reemplazarRecurso(db, userId, creado.id, "https://drive.google.com/v2");

    const filas = await recursosVigentes({ programId: programaA }, db);
    expect(filas).toHaveLength(1);
    expect(filas[0].url).toBe("https://drive.google.com/v2");
  });
});

describe("enlacesDePagoVigentes — con programa, producto, plataforma, monto y moneda", () => {
  it("resuelve los nombres y deja el producto nulo cuando no lo hay", async () => {
    const [prod] = await db
      .insert(productos)
      .values({ programId: programaA, nombre: "Programa completo", precioLista: "797.00", moneda: "USD" })
      .returning();

    await crearEnlacePago(db, userId, {
      programId: programaA,
      productoId: prod.id,
      plataformaId: plataforma,
      monto: "797.00",
      moneda: "USD",
      url: "https://paypal.com/con-producto",
    });
    await crearEnlacePago(db, userId, {
      programId: programaA,
      plataformaId: plataforma,
      monto: "500000",
      moneda: "COP",
      url: "https://paypal.com/sin-producto",
    });

    const filas = await enlacesDePagoVigentes({}, db);
    expect(filas).toHaveLength(2);
    const conProducto = filas.find((f) => f.url.endsWith("con-producto"))!;
    expect(conProducto.programaNombre).toBe("Comunicarte");
    expect(conProducto.productoNombre).toBe("Programa completo");
    expect(conProducto.plataformaNombre).toBe("PayPal");
    expect(conProducto.moneda).toBe("USD");
    const sinProducto = filas.find((f) => f.url.endsWith("sin-producto"))!;
    expect(sinProducto.productoNombre).toBeNull();
    expect(sinProducto.moneda).toBe("COP");
  });
});

describe("historialDeRecurso — versiones anteriores en orden tras dos reemplazos", () => {
  it("devuelve las versiones anteriores, de la mas reciente a la mas vieja", async () => {
    const v1 = await crearRecurso(db, userId, {
      programId: programaA,
      categoriaId: categoriaBrochure,
      titulo: "Brochure",
      url: "https://drive.google.com/v1",
    });

    const v2 = await reemplazarRecurso(db, userId, v1.id, "https://drive.google.com/v2");
    const v3 = await reemplazarRecurso(db, userId, v2.id, "https://drive.google.com/v3");

    // El vigente es v3; su historial son v2 y v1, en ese orden.
    const historial = await historialDeRecurso(v3.id, db);
    expect(historial.map((h) => h.url)).toEqual([
      "https://drive.google.com/v2",
      "https://drive.google.com/v1",
    ]);
  });

  it("carga varios historiales con una sola consulta", async () => {
    const v1 = await crearRecurso(db, userId, {
      programId: programaA,
      categoriaId: categoriaBrochure,
      titulo: "Brochure",
      url: "https://drive.google.com/v1",
    });
    const v2 = await reemplazarRecurso(db, userId, v1.id, "https://drive.google.com/v2");
    const v3 = await reemplazarRecurso(db, userId, v2.id, "https://drive.google.com/v3");
    const otro = await crearRecurso(db, userId, {
      programId: programaA,
      categoriaId: categoriaGuion,
      titulo: "Guion",
      url: "https://drive.google.com/guion",
    });

    const historiales = await historialesDeRecursos([v3.id, otro.id], db);
    expect(historiales.get(v3.id)?.map((h) => h.url)).toEqual([
      "https://drive.google.com/v2",
      "https://drive.google.com/v1",
    ]);
    expect(historiales.get(otro.id)).toEqual([]);
  });

  it("un recurso sin reemplazos tiene historial vacio", async () => {
    const v1 = await crearRecurso(db, userId, {
      programId: programaA,
      categoriaId: categoriaBrochure,
      titulo: "Solo uno",
      url: "https://drive.google.com/unico",
    });
    expect(await historialDeRecurso(v1.id, db)).toEqual([]);
  });
});
