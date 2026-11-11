import { describe, expect, it } from "vitest";
import type { ObjetivoDeCohorte } from "@/lib/catalogo/objetivos";
import { cifrasDeProyeccion } from "@/lib/pauta/cifras-de-proyeccion";
import type { ProyeccionDeRoas, ProyeccionGuardada } from "@/lib/queries/proyeccion-roas";
import { cifrasDelSemaforo, motivoSinCosto } from "@/lib/semaforo/cifras-del-semaforo";
import type { MetricaSemaforo } from "@/lib/semaforo/semaforo";

/** 419 paso 3: el semáforo como cuatro Cifras (diseño §4.2) y la proyección del ROAS como dos (§4.5). */
const semaforo = (o: Partial<MetricaSemaforo> = {}): MetricaSemaforo => ({
  metrica: "costo_por_agenda", color: "alerta", motivo: null, moneda: "COP", dia: "2026-11-11",
  gasto: 403_200, agendasMeta: 9, agendasCrm: 11, costo: 44_800,
  umbral: { meta: 40_000, aceptable: 50_000 }, porcentajeDelUmbral: 112,
  comparacion: { dia: "2026-11-10", gasto: 300_000, agendasMeta: 10, agendasCrm: 8, costo: 30_000, etiqueta: "ayer a esta hora" },
  trayectoria: [], racha: null, campanas: [], lanzamiento: { gasto: 57_000, registrosMeta: null, costoPorRegistro: null, campanas: [] },
  gastoTotal: 460_200, notas: [], ...o,
});

describe("419: el semáforo como cuatro Cifras", () => {
  it("el costo es el del semáforo, con sus partes, su color y la línea de otras campañas", () => {
    const c = cifrasDelSemaforo({ metrica: semaforo(), tipo: "dia", hora: "3:00 p. m.", comparar: false, programa: "Tactical" });
    expect(c.costo.textoDelValor).toBe("COP 44.800");
    expect(c.costo.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: COP 403.200 ÷ 9 = COP 44.800");
    expect(c.costo.estado).toEqual({ tono: "alerta", rotulo: "En seguimiento" });
    expect(c.costo.linea).toEqual({ antes: "Sin contar ", cifra: "COP 57.000", despues: " de otras campañas" });
    expect(c.agendas.textoDelValor).toBe("11");
    expect(c.agendasMeta.textoDelValor).toBe("9");
    expect(c.inversion.textoDelValor).toBe("COP 460.200");
    expect(c.costo.etiquetas).toEqual(["En curso"]);
    expect(c.costo.explicacion.filtros).toEqual([["Programa", "Tactical"], ["Área", "Paid"], ["Día", "Hoy hasta las 3:00 p. m."]]);
    expect(c.subtitulo).toBe("Hoy hasta las 3:00 p. m. Siempre es de hoy, sin importar el periodo elegido.");
  });

  it("compara con ayer a esta hora solo si se pidió comparar", () => {
    expect(cifrasDelSemaforo({ metrica: semaforo(), tipo: "dia", hora: "3:00 p. m.", comparar: false }).costo.comparacion).toBeNull();
    const c = cifrasDelSemaforo({ metrica: semaforo(), tipo: "dia", hora: "3:00 p. m.", comparar: true });
    expect(c.costo.comparacion?.texto).toBe("ayer a esta hora (10-nov)");
    expect(c.agendas.comparacion?.cifra).toBe("8");
    expect(c.inversion.comparacion).toBeNull();
  });

  it("el estado es el color del semáforo aunque el costo no se pueda calcular (gasto sin agendas de Meta)", () => {
    const c = cifrasDelSemaforo({ metrica: semaforo({ color: "peligro", agendasMeta: 0, agendasCrm: 0, costo: null }), tipo: "cierre", hora: "7:00 p. m.", comparar: false });
    expect(c.costo.textoDelValor).toBe("—");
    expect(c.costo.estado?.tono).toBe("peligro");
    expect(c.costo.explicacion.lectura[0][1]).toContain("Meta no reporta ninguna agenda");
    expect(c.costo.etiquetas).toEqual([]);
    expect(c.subtitulo).toContain("Ayer completo (11-nov)");
  });

  it("sin dato no hay color; el motivo del vacío sale de los datos", () => {
    const c = cifrasDelSemaforo({ metrica: semaforo({ color: "sin_dato", motivo: "sin_umbral", umbral: null }), tipo: "dia", hora: "3:00 p. m.", comparar: false });
    expect(c.costo.estado).toBeNull();
    expect(motivoSinCosto({ gasto: 1, agendasMeta: null, agendasCrm: 0 }, true)).toBe("Meta no reporta agendas de este programa");
    expect(motivoSinCosto({ gasto: 0, agendasMeta: 0, agendasCrm: 0 }, true)).toBe("No hubo gasto en campañas de agenda");
    expect(motivoSinCosto({ gasto: 5, agendasMeta: 0, agendasCrm: 2 }, true)).toContain("con retraso");
    expect(motivoSinCosto({ gasto: 5, agendasMeta: 0, agendasCrm: 2 }, false)).toContain("ninguna agenda");
  });
});

const proyeccion = (o: Partial<ProyeccionDeRoas> = {}): ProyeccionDeRoas => ({
  valor: 8.3, motivo: null, esperadoUsd: 4_400,
  supuestos: {
    semanas: 3, muestraMinima: 10, programa: { muestra: 40, pShow: 0.5, pCierre: 0.3 },
    porCloser: [{ clave: "maru", closer: "Maru", citas: 18, pShow: 0.5, pCierre: 0.3, muestra: 4, usaPrograma: true } as ProyeccionDeRoas["supuestos"]["porCloser"][number]],
    citasPendientesIds: [], sinTicket: 0,
  },
  rango: { desde: "2026-11-02", hasta: "2026-11-15" },
  gastoUsd: 2_000, vendidoUsd: 12_200,
  roasAHoy: { valor: 6.1, base: 10, faltan: 0, motivo: null },
  citasPendientes: 18, ultimaCitaEn: new Date("2026-11-20T15:00:00Z"), ...o,
});
const guardada = (o: Partial<ProyeccionGuardada>): ProyeccionGuardada => ({
  dia: "2026-11-03", desde: "2026-10-27", hasta: "2026-11-02", roasProyectado: 7.2, motivo: null, citasPendientes: 5,
  confirmadaEn: new Date(), roasReal: 6.8, ...o,
});
const objetivoRoas: ObjetivoDeCohorte = { id: "o", cohortId: "c", area: "paid", metrica: "roas", meta: 8, aceptable: 5, moneda: null, activo: true };

describe("419: la proyección del ROAS como dos Cifras", () => {
  it("ROAS a hoy: parcial con las citas pendientes, partes y estado por objetivo", () => {
    const { aHoy } = cifrasDeProyeccion({ proyeccion: proyeccion(), historial: [], objetivos: [objetivoRoas], hoy: "2026-11-20" });
    expect(aHoy.textoDelValor).toBe("6,1×");
    expect(aHoy.etiquetas).toEqual(["Parcial"]);
    expect(aHoy.linea).toEqual({ antes: "", cifra: "18", despues: " citas de pauta pendientes" });
    expect(aHoy.estado).toEqual({ tono: "alerta", rotulo: "En seguimiento" });
    expect(aHoy.explicacion.formula.conLosNumeros).toBe("Con los números de esta cifra: USD 12.200,00 ÷ USD 2.000,00 = 6,1×");
  });

  it("ROAS proyectado: la última confirmada contra lo real y los supuestos de cada closer", () => {
    const { proyectado } = cifrasDeProyeccion({
      proyeccion: proyeccion(),
      historial: [guardada({ dia: "2026-10-27", roasProyectado: 5, roasReal: 5.5 }), guardada({}), guardada({ dia: "2026-11-04", roasReal: null })],
      objetivos: [], hoy: "2026-11-20",
    });
    expect(proyectado.textoDelValor).toBe("8,3×");
    expect(proyectado.linea).toEqual({ antes: "Proyectado el 3-nov: ", cifra: "7,2×", despues: " · real: 6,8×" });
    expect(proyectado.explicacion.lectura.some(([r, t]) => r === "Maru" && t.includes("con la tasa del programa"))).toBe(true);
  });

  it("un proyectado que no se puede calcular dice por qué", () => {
    const { proyectado } = cifrasDeProyeccion({ proyeccion: proyeccion({ valor: null, motivo: "Falta el gasto de 3 días del periodo" }), historial: [], objetivos: [], hoy: "2026-11-20" });
    expect(proyectado.textoDelValor).toBe("—");
    expect(proyectado.explicacion.lectura[0][1]).toContain("Falta el gasto de 3 días del periodo");
  });
});

describe("419: ningún texto del semáforo lleva doble punto", () => {
  it("la hora con «p. m.» no deja «..» en el subtítulo ni en la lectura", () => {
    const c = cifrasDelSemaforo({ metrica: semaforo(), tipo: "dia", hora: "3:00 p. m.", comparar: true });
    const textos = [c.subtitulo, ...[c.costo, c.agendas, c.agendasMeta, c.inversion].flatMap((x) => x.explicacion.lectura.map(([, t]) => t))];
    for (const t of textos) expect(t).not.toMatch(/\.\./);
  });
});
