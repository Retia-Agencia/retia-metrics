import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

/**
 * Ticket 463 (retiro de la tabla `productos` y de cuatro columnas del modelo viejo de precio y comisión).
 * Mientras la migración no corre, las columnas siguen en `lib/db/schema.ts`, pero nadie debe leerlas ni
 * escribirlas de nuevo: el precio sale de `precioDeReferenciaDelCiclo` (lib/cohortes/precio-de-referencia.ts), el
 * nombre y el cupo del SKU de `skus`, y la comisión de `deal_lineas.comision_porcentaje`.
 *
 * Se vigilan, fuera de `lib/db/schema.ts` (que las declara hasta la migración):
 *   - la tabla `productos` y `skus.producto_id`;
 *   - `programs.ticket_usd`, `programs.comision_porcentaje`, `cohorts.precio_usd` y `deals.comision_porcentaje`.
 * NO se vigilan `skus.precio_usd`/`precio_lista_usd` ni `deal_lineas.comision_porcentaje`: esas se quedan.
 *
 * Límite honesto: `precioUsd`, `ticketUsd` y `comisionPorcentaje` son nombres que otras cosas también usan (la
 * vista de una cohorte, un SKU, una línea), así que solo se mide la forma de consulta `tabla.campo`, el nombre en
 * mayúsculas del SQL y los dos nombres sin ambigüedad (`productos`, `productoId`). Los restos que la migración
 * debe borrar junto con el esquema están nombrados abajo, con archivo y motivo.
 */
const RAIZ = process.cwd();

type Regla = { nombre: string; patron: RegExp };

const REGLAS: Regla[] = [
  { nombre: "tabla productos", patron: /(?<![\w$])productos(?![\w$])/ },
  { nombre: "skus.producto_id", patron: /(?<![\w$])(productoId|producto_id)(?![\w$])/ },
  { nombre: "programs.ticket_usd", patron: /(?<![\w$])(programs\.ticketUsd|ticket_usd)(?![\w$])/ },
  { nombre: "programs.comision_porcentaje", patron: /(?<![\w$])programs\.comisionPorcentaje(?![\w$])/ },
  { nombre: "cohorts.precio_usd", patron: /(?<![\w$])(cohorts\.precioUsd|precio_usd)(?![\w$])/ },
  { nombre: "deals.comision_porcentaje", patron: /(?<![\w$])deals\.comisionPorcentaje(?![\w$])/ },
];

/** Restos con la forma `ticketUsd` / `comisionPorcentaje` de un programa que la migración 463 retira con el esquema. */
const RESTOS_DE_PROGRAMA: Record<string, string> = {
  "lib/catalogo/programas.ts": "el insert de crear programa exige ticket_usd (notNull) y la edición aún escribe el % del programa",
  "app/(app)/p/[programa]/programa/acciones-programa.ts": "tipo de compatibilidad del cliente anterior al 461",
  "lib/queries/proyeccion-roas.ts": "falso positivo: `ticketUsd` es un campo local con el precio de referencia del ciclo",
};

function codigo(): Array<{ rel: string; texto: string }> {
  return ["lib", "app", "components", "scripts"].flatMap((c) => archivos(path.join(RAIZ, c)))
    .map((f) => ({ rel: path.relative(RAIZ, f).split(path.sep).join("/"), f }))
    .filter(({ rel }) => rel !== "lib/db/schema.ts")
    .map(({ rel, f }) => ({ rel, texto: sinComentarios(fs.readFileSync(f, "utf8")) }));
}

export function lectoresDe(regla: Regla, fuentes: Array<{ rel: string; texto: string }>): string[] {
  return fuentes.filter(({ texto }) => regla.patron.test(texto)).map(({ rel }) => rel);
}

describe("guardián 463: nadie lee ni escribe lo que la migración retira", () => {
  const fuentes = codigo();

  it("el escaneo ve código", () => {
    expect(fuentes.length).toBeGreaterThan(100);
  });

  for (const regla of REGLAS) {
    it(`sin lectores ni escritores de ${regla.nombre} fuera del esquema`, () => {
      expect(lectoresDe(regla, fuentes)).toEqual([]);
    });
  }

  it("`ticketUsd` solo vive en los restos nombrados de programa", () => {
    const con = lectoresDe({ nombre: "ticketUsd", patron: /(?<![\w$])ticketUsd(?![\w$])/ },
      fuentes.filter(({ rel }) => !/^scripts\/seed/.test(rel)));
    expect(con.filter((rel) => !(rel in RESTOS_DE_PROGRAMA))).toEqual([]);
  });

  it("sin restos zombi: cada archivo nombrado sigue teniendo el resto", () => {
    const con = new Set(lectoresDe({ nombre: "ticketUsd", patron: /(?<![\w$])ticketUsd(?![\w$])/ }, fuentes));
    expect(Object.keys(RESTOS_DE_PROGRAMA).filter((rel) => !con.has(rel))).toEqual([]);
  });

  it("muerde: caza cada forma y deja pasar las columnas que se quedan", () => {
    const f = (texto: string) => [{ rel: "x.ts", texto }];
    const cazar = (nombre: string, texto: string) => lectoresDe(REGLAS.find((r) => r.nombre === nombre)!, f(texto)).length;
    expect(cazar("tabla productos", "db.select().from(productos)")).toBe(1);
    expect(cazar("skus.producto_id", "eq(skus.productoId, x)")).toBe(1);
    expect(cazar("programs.ticket_usd", "select({ t: programs.ticketUsd })")).toBe(1);
    expect(cazar("programs.comision_porcentaje", "eq(programs.comisionPorcentaje, 1)")).toBe(1);
    expect(cazar("cohorts.precio_usd", "max(cohorts.precioUsd)")).toBe(1);
    expect(cazar("deals.comision_porcentaje", "set({ x: deals.comisionPorcentaje })")).toBe(1);
    expect(cazar("cohorts.precio_usd", "min(skus.precioListaUsd), skus.precioUsd")).toBe(0);
    expect(cazar("deals.comision_porcentaje", "dealLineas.comisionPorcentaje, skus.comisionPorcentaje")).toBe(0);
    expect(cazar("tabla productos", "const productosVisibles = 1")).toBe(0);
  });
});
