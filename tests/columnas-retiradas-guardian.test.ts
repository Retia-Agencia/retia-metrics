import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { archivos, sinComentarios } from "./helpers/codigo-fuente";

/**
 * Ticket 463 (retiro de la tabla `productos` y de cuatro columnas del modelo viejo de precio y comisión, migración
 * 0161). Ya no existen en `lib/db/schema.ts`: nadie debe volver a leerlas ni a escribirlas. El precio sale de
 * `precioDeReferenciaDelCiclo` (lib/cohortes/precio-de-referencia.ts), el nombre y el cupo del SKU de `skus`, y la
 * comisión de `skus.comision_porcentaje` y `deal_lineas.comision_porcentaje`.
 *
 * Se vigilan, también dentro de `lib/db/schema.ts`:
 *   - la tabla `productos` y `skus.producto_id`;
 *   - `programs.ticket_usd`, `programs.comision_porcentaje`, `cohorts.precio_usd` y `deals.comision_porcentaje`.
 * NO se vigilan `skus.precio_lista_usd` ni `deal_lineas.comision_porcentaje`: esas se quedan.
 *
 * Límite honesto: `precioUsd`, `ticketUsd` y `comisionPorcentaje` son nombres que otras cosas también usan (la
 * vista de una cohorte, un SKU, una línea), así que solo se mide la forma de consulta `tabla.campo`, el nombre en
 * mayúsculas del SQL y los dos nombres sin ambigüedad (`productos`, `productoId`).
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

/** `ticketUsd` solo sobrevive como campo local de la proyección de ROAS (el precio de referencia del ciclo). */
const RESTOS_DE_TICKET: Record<string, string> = {
  "lib/queries/proyeccion-roas.ts": "falso positivo: `ticketUsd` es un campo local con el precio de referencia del ciclo",
};

function codigo(): Array<{ rel: string; texto: string }> {
  return ["lib", "app", "components", "scripts"].flatMap((c) => archivos(path.join(RAIZ, c)))
    .map((f) => ({ rel: path.relative(RAIZ, f).split(path.sep).join("/"), f }))
    // El respaldo previo a la 0161 lee esas columnas con SQL crudo a propósito (única excepción, ADR 0131).
    .filter(({ rel }) => rel !== "scripts/respaldo-463.ts")
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

  it("`ticketUsd` solo vive en el resto nombrado", () => {
    const con = lectoresDe({ nombre: "ticketUsd", patron: /(?<![\w$])ticketUsd(?![\w$])/ }, fuentes);
    expect(con.filter((rel) => !(rel in RESTOS_DE_TICKET))).toEqual([]);
  });

  it("sin restos zombi: cada archivo nombrado sigue teniendo el resto", () => {
    const con = new Set(lectoresDe({ nombre: "ticketUsd", patron: /(?<![\w$])ticketUsd(?![\w$])/ }, fuentes));
    expect(Object.keys(RESTOS_DE_TICKET).filter((rel) => !con.has(rel))).toEqual([]);
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
