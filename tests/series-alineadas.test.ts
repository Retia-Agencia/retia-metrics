import { expect, it } from "vitest";
import { pivotarSerie } from "@/lib/series-alineadas";

const alcance = { programId: "p", rango: { desde: "2026-02-28", hasta: "2026-03-02" } };
const filas = [
  { programId: "p", dia: "2026-02-28", area: "paid", leads: 2 },
  { programId: "p", dia: "2026-02-28", area: "paid", leads: 3 },
  { programId: "p", dia: "2026-03-02", area: "organico", leads: 7 },
];
const pivotar = (datos = filas) => pivotarSerie(datos, alcance, (f) => f.area, (f) => f.leads);
it("alinea N series, suma duplicados y rellena huecos con 0, sin depender del orden", () => {
  expect(pivotar()).toEqual({ programId: "p", dias: ["2026-02-28", "2026-03-01", "2026-03-02"], series: [{ clave: "organico", valores: [0, 0, 7] }, { clave: "paid", valores: [5, 0, 0] }] });
  expect(pivotar([...filas].reverse())).toEqual(pivotar());
});
it("rechaza otro programa y excluye días fuera de rango", () => {
  expect(() => pivotar([{ ...filas[0], programId: "otro" }])).toThrow("programas");
  expect(pivotar([{ ...filas[0], dia: "2026-02-27" }]).series).toEqual([]);
  expect(pivotar([]).series).toEqual([]);
});
