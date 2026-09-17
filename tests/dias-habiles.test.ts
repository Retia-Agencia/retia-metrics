import { describe, expect, it } from "vitest";
import {
  esDiaHabil,
  diasHabilesEntre,
  diaHabilDe,
  metaDinamica,
  metaLineal,
} from "@/lib/dias-habiles";

describe("esDiaHabil", () => {
  it("un dia entre semana es habil", () => {
    // 2026-09-15 es martes.
    expect(esDiaHabil("2026-09-15")).toBe(true);
  });

  it("sabado y domingo no son habiles", () => {
    expect(esDiaHabil("2026-09-19")).toBe(false); // sabado
    expect(esDiaHabil("2026-09-20")).toBe(false); // domingo
  });

  it("un festivo colombiano SI es habil (regla de Retia)", () => {
    // 2026-08-17 fue festivo en Colombia y cae lunes: cuenta como habil.
    expect(esDiaHabil("2026-08-17")).toBe(true);
  });

  it("un Date se interpreta por su dia de calendario en Bogota, no en UTC", () => {
    // 2026-09-16T03:00:00Z son las 22:00 del 2026-09-15 en Bogota (UTC-5):
    // el dia de calendario es el 15 (martes), habil, no el 16.
    expect(esDiaHabil(new Date("2026-09-16T03:00:00Z"))).toBe(true);
    // 2026-09-21T02:00:00Z = 21:00 del domingo 2026-09-20 en Bogota: NO habil,
    // aunque en UTC ya sea lunes 21.
    expect(esDiaHabil(new Date("2026-09-21T02:00:00Z"))).toBe(false);
  });
});

describe("diasHabilesEntre", () => {
  it("cuenta inclusive en ambos extremos", () => {
    // Septiembre 2026 completo: 22 dias habiles (del reporte del 15-sep).
    expect(diasHabilesEntre("2026-09-01", "2026-09-30")).toBe(22);
  });

  it("los dias remanentes de TI tras el 15-sep son 10", () => {
    expect(diasHabilesEntre("2026-09-16", "2026-09-29")).toBe(10);
  });

  it("un solo dia habil cuenta 1", () => {
    expect(diasHabilesEntre("2026-09-15", "2026-09-15")).toBe(1);
  });

  it("un solo dia de fin de semana cuenta 0", () => {
    expect(diasHabilesEntre("2026-09-19", "2026-09-19")).toBe(0);
  });

  it("devuelve 0 si fin < inicio", () => {
    expect(diasHabilesEntre("2026-09-30", "2026-09-01")).toBe(0);
  });
});

describe("diaHabilDe", () => {
  it("septiembre 2026: el 15 es el dia habil 11 de 22", () => {
    expect(diaHabilDe("2026-09-15", "2026-09-01", "2026-09-30")).toEqual({ dia: 11, total: 22 });
  });

  it("ventana de TI C2 (19-ago a 29-sep): 20 de 30", () => {
    expect(diaHabilDe("2026-09-15", "2026-08-19", "2026-09-29")).toEqual({ dia: 20, total: 30 });
  });

  it("ventana de Comunicarte C2 (14-ago a 21-sep): 23 de 27, con el festivo contando", () => {
    // 2026-08-17 fue festivo colombiano y esta dentro de la ventana: cuenta.
    expect(diaHabilDe("2026-09-15", "2026-08-14", "2026-09-21")).toEqual({ dia: 23, total: 27 });
  });

  it("en fin de semana, dia es el conteo de habiles hasta esa fecha (el del habil previo)", () => {
    // Del 1 al 30 de septiembre. El viernes 18 es el dia habil 14; el sabado 19 y
    // el domingo 20 no suman, asi que siguen valiendo 14 hasta el lunes 21 (=15).
    expect(diaHabilDe("2026-09-18", "2026-09-01", "2026-09-30").dia).toBe(14);
    expect(diaHabilDe("2026-09-19", "2026-09-01", "2026-09-30").dia).toBe(14);
    expect(diaHabilDe("2026-09-20", "2026-09-01", "2026-09-30").dia).toBe(14);
    expect(diaHabilDe("2026-09-21", "2026-09-01", "2026-09-30").dia).toBe(15);
  });

  it("antes del inicio da 0; despues del fin queda topado en total", () => {
    expect(diaHabilDe("2026-08-31", "2026-09-01", "2026-09-30")).toEqual({ dia: 0, total: 22 });
    expect(diaHabilDe("2026-10-05", "2026-09-01", "2026-09-30")).toEqual({ dia: 22, total: 22 });
  });
});

describe("metaDinamica", () => {
  it("cupos por dia habil = faltantes / dias restantes (caso del reporte: 28 en 10 = 2,8)", () => {
    expect(metaDinamica({ meta: 30, vendidos: 2, diasHabilesRestantes: 10 })).toBe(2.8);
  });

  it("no redondea: deja el decimal crudo (formatear es tarea de lib/format)", () => {
    // 28 faltantes / 9 dias = 3.111...
    expect(metaDinamica({ meta: 30, vendidos: 2, diasHabilesRestantes: 9 })).toBeCloseTo(28 / 9, 10);
  });

  it("con vendidos >= meta no hay nada por vender: 0", () => {
    expect(metaDinamica({ meta: 30, vendidos: 30, diasHabilesRestantes: 5 })).toBe(0);
    expect(metaDinamica({ meta: 30, vendidos: 42, diasHabilesRestantes: 5 })).toBe(0);
  });

  it("con 0 dias restantes NO divide por cero: devuelve los faltantes, o 0 si ya se cumplio", () => {
    expect(metaDinamica({ meta: 30, vendidos: 2, diasHabilesRestantes: 0 })).toBe(28);
    expect(metaDinamica({ meta: 30, vendidos: 30, diasHabilesRestantes: 0 })).toBe(0);
  });
});

describe("metaLineal", () => {
  it("meta repartida entre los dias habiles totales", () => {
    expect(metaLineal({ meta: 30, diasHabilesTotales: 30 })).toBe(1);
    expect(metaLineal({ meta: 30, diasHabilesTotales: 22 })).toBeCloseTo(30 / 22, 10);
  });

  it("con 0 dias totales NO divide por cero: devuelve 0", () => {
    expect(metaLineal({ meta: 30, diasHabilesTotales: 0 })).toBe(0);
  });
});
