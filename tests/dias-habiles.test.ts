import { describe, expect, it } from "vitest";
import {
  diaHabilAnterior,
  diaCalendarioAnterior,
  esDiaHabil,
  diasHabilesEntre,
  diaHabilDe,
  esperadoLineal,
  metaDeHoy,
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

describe("diaCalendarioAnterior", () => {
  it("incluye el domingo anterior a un lunes", () => {
    expect(diaCalendarioAnterior("2026-10-19")).toBe("2026-10-18");
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

describe("metaDeHoy", () => {
  // 2026-10-21 es miercoles; del 21-oct al 4-nov hay 11 habiles contando hoy.
  const base = { hoy: "2026-10-21", cierre: "2026-11-04" };

  it("lo que faltaba al abrir hoy entre los habiles que quedan CONTANDO hoy", () => {
    expect(metaDeHoy({ ...base, meta: 30, vendidosAntesDeHoy: 8 })).toBeCloseTo(22 / 11, 10);
  });

  it("con la meta cumplida antes de hoy pide 0", () => {
    expect(metaDeHoy({ ...base, meta: 30, vendidosAntesDeHoy: 42 })).toBe(0);
  });

  it("el ultimo dia habil da el faltante entero, y lo mismo pasado el cierre (no divide por cero)", () => {
    expect(metaDeHoy({ meta: 30, vendidosAntesDeHoy: 28, hoy: "2026-11-04", cierre: "2026-11-04" })).toBe(2);
    expect(metaDeHoy({ meta: 30, vendidosAntesDeHoy: 28, hoy: "2026-11-05", cierre: "2026-11-04" })).toBe(2);
  });
});

describe("esperadoLineal", () => {
  const v = { meta: 30, inicio: "2026-10-05", cierre: "2026-11-13" }; // 30 habiles: 1 por dia
  it("ritmo lineal por los habiles transcurridos, contando el dia de `hasta`", () => {
    expect(esperadoLineal({ ...v, hasta: "2026-10-05" })).toBe(1);
    expect(esperadoLineal({ ...v, hasta: "2026-10-09" })).toBe(5);
  });
  it("antes del inicio es 0 y despues del cierre es la meta entera", () => {
    expect(esperadoLineal({ ...v, hasta: "2026-10-01" })).toBe(0);
    expect(esperadoLineal({ ...v, hasta: "2026-12-01" })).toBe(30);
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

describe("ventanas de venta de las cohortes C2 (ADR 0022, numeros del reporte)", () => {
  // Estas dos ventanas son datos por cohorte (fechaInicioVentas / fechaCierreVentas),
  // no reglas del codigo. Anclamos los numeros exactos del reporte diario de Retia
  // para que un cambio silencioso en lib/dias-habiles los rompa aqui.
  it("Comunicarte C2 (14-ago a 21-sep): 27 habiles y el 15-sep es el dia 23", () => {
    expect(diasHabilesEntre("2026-08-14", "2026-09-21")).toBe(27);
    expect(diaHabilDe("2026-09-15", "2026-08-14", "2026-09-21")).toEqual({ dia: 23, total: 27 });
  });

  it("Tactical C2 (19-ago a 29-sep): 30 habiles y el 15-sep es el dia 20", () => {
    expect(diasHabilesEntre("2026-08-19", "2026-09-29")).toBe(30);
    expect(diaHabilDe("2026-09-15", "2026-08-19", "2026-09-29")).toEqual({ dia: 20, total: 30 });
  });
});

describe("diaHabilAnterior", () => {
  it("salta el fin de semana y no salta un festivo", () => {
    expect(diaHabilAnterior("2026-10-12")).toBe("2026-10-09");
    expect(diaHabilAnterior("2026-10-14")).toBe("2026-10-13");
    // 12-oct es festivo en Colombia y para Retia es hábil.
    expect(diaHabilAnterior("2026-10-13")).toBe("2026-10-12");
  });
});
