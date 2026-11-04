import { expect, it } from "vitest";
import { fraseDeAvance } from "@/lib/metas/frase-de-avance";
import type { CeldaDeMeta } from "@/lib/queries/vamos-a-llegar";

const celda = (cambios: Partial<CeldaDeMeta> = {}): CeldaDeMeta => ({
  llevamos: 12, meta: 30, pct: 0.4, faltan: 18, esperado: 24,
  porDiaHabil: 1.4, proyeccion: null, tono: "peligro", ...cambios,
});

it("dice cuánto va atrás y el ritmo hasta el cierre", () => {
  expect(fraseDeAvance(celda(), { cierre: "2026-11-20" }))
    .toBe("Llevas 12 de 30 cupos. Vas 12 atrás. Necesitas 1,4 ventas por día hábil hasta el 20 nov 2026.");
});

it("dice cuánto va adelante", () => {
  expect(fraseDeAvance(celda({ esperado: 10 }), { cierre: "2026-11-20" }))
    .toBe("Llevas 12 de 30 cupos. Vas 2 adelante.");
});

it("dice que va al día", () => {
  expect(fraseDeAvance(celda({ esperado: 12 }), { cierre: "2026-11-20" }))
    .toBe("Llevas 12 de 30 cupos. Vas al día.");
});

it("dice que ya llegó", () => {
  expect(fraseDeAvance(celda({ llevamos: 31, meta: 30 }), { cierre: "2026-11-20" }))
    .toBe("Ya llegaste: 31 de 30 cupos.");
});

it("dice sin meta", () => {
  expect(fraseDeAvance(celda({ meta: null }), { cierre: "2026-11-20" })).toBe("Sin meta.");
});

it("sin cierre conserva el ritmo y omite hasta cuándo", () => {
  expect(fraseDeAvance(celda(), { cierre: null }))
    .toBe("Llevas 12 de 30 cupos. Vas 12 atrás. Necesitas 1,4 ventas por día hábil.");
});
