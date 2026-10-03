import { describe, expect, it } from "vitest";
import { propiedadesQueLeFaltan, queLeFalta, type CodigoRequisito, type HechosDelDeal, type PropiedadesDelDeal } from "@/lib/deals/requisitos";

/**
 * Ticket 044 — los requisitos de cada flecha, como predicados puros.
 *
 * La matriz completa del ticket 142 se importa al final; estos casos conservan
 * las rejas transversales que ya cubría este archivo.
 */
type Codigo = Exclude<CodigoRequisito, "transicion_no_permitida" | "cohorte">;

const REQUISITOS_A1: Codigo[] = ["sin_abonos"];
const REQUISITOS_A2: Codigo[] = ["saldo_pendiente"];
const REQUISITOS_E13: Codigo[] = ["valor_vendido", "saldo_en_cero", "area_declarada"];

/** Un deal que no cumple nada. */
const NADA: HechosDelDeal = {
  tieneDueno: false,
  tieneActividadComercial: false,
  tieneContactoRegistrado: false,
  pendienteActual: null,
  tieneLlamadaConFecha: false,
  llamadaSucedio: false,
  llamadaFallida: false,
  valorVendidoUsd: null,
  areaDeclaradaId: null,
  esHistorico: false,
  fechaLimitePago: null,
  cohorteDestinoId: null,
  fechaInicioVentasCohorteDestino: null,
  fechaUltimoContacto: null,
  fechaSeguimiento: null,
  abonosVigentes: 0,
  saldo: null,
  motivoId: null,
};

/** Como se CUMPLE cada requisito, y como se ROMPE partiendo de un deal que si lo cumplia. */
const CUMPLIR: Record<Codigo, Partial<HechosDelDeal>> = {
  dueno: { tieneDueno: true },
  actividad: { tieneActividadComercial: true },
  contacto: { tieneContactoRegistrado: true },
  llamada_con_fecha: { tieneLlamadaConFecha: true },
  llamada_sucedio: { llamadaSucedio: true },
  llamada_fallida: { llamadaFallida: true },
  valor_vendido: { valorVendidoUsd: 797 },
  area_declarada: { areaDeclaradaId: "area-1" },
  fecha_limite_pago: { fechaLimitePago: "2026-10-15" },
  cohorte_destino: { cohorteDestinoId: "coh-2" },
  fecha_seguimiento: { fechaSeguimiento: "2026-10-01" },
  abono: { abonosVigentes: 1 },
  saldo_pendiente: { saldo: 300 },
  saldo_en_cero: { saldo: 0 },
  sin_abonos: { abonosVigentes: 0 },
  motivo: { motivoId: "motivo-1" },
};

const cumpliendo = (codigos: Codigo[]): HechosDelDeal =>
  Object.assign({}, NADA, ...codigos.map((c) => CUMPLIR[c]));

describe("lo que no es un requisito", () => {
  it("una flecha que no existe se rechaza con las etapas por su nombre", () => {
    const falta = queLeFalta("registrado", "ganado_completo", cumpliendo(["valor_vendido", "abono", "saldo_en_cero"]));
    expect(falta).toEqual([
      { codigo: "transicion_no_permitida", mensaje: "Un deal no puede pasar de Registrado a Ganado Pagado Completo." },
    ]);
  });

  it("devuelve TODO lo que falta, no solo lo primero", () => {
    expect(queLeFalta("atendido", "ganado_parcial", NADA).map((f) => f.codigo)).toEqual([
      "valor_vendido",
      "abono",
      "saldo_pendiente",
      "area_declarada",
    ]);
  });

  it("un deal sin valor vendido no tiene saldo contra el cual ir a Completo", () => {
    const hechos = { ...cumpliendo(["abono", "area_declarada"]), saldo: null };
    expect(queLeFalta("ganado_parcial", "ganado_completo", hechos).map((f) => f.codigo)).toEqual(["valor_vendido", "saldo_en_cero"]);
  });

  it("A1 y A2 no piden área declarada", () => {
    expect(REQUISITOS_A1).not.toContain("area_declarada");
    expect(REQUISITOS_A2).not.toContain("area_declarada");
  });

  it("un deal histórico está exento del área declarada", () => {
    const hechos = { ...cumpliendo(REQUISITOS_E13), areaDeclaradaId: null, esHistorico: true };
    expect(queLeFalta("ganado_parcial", "ganado_completo", hechos)).toEqual([]);
  });

  it("un deal histórico está exento del valor vendido", () => {
    const hechos = { ...cumpliendo(REQUISITOS_E13), valorVendidoUsd: null, esHistorico: true };
    expect(queLeFalta("ganado_parcial", "ganado_completo", hechos)).toEqual([]);
  });

  it("un sobrepago que se colo cuenta como pagado: el deal no queda trabado en Abonado", () => {
    const hechos = { ...cumpliendo(["valor_vendido", "abono", "area_declarada"]), saldo: -50 };
    expect(queLeFalta("ganado_parcial", "ganado_completo", hechos)).toEqual([]);
  });
});

const PROPIEDADES_COMPLETAS: PropiedadesDelDeal = {
  tieneCohorte: true, tieneDueno: true, tieneContactoRegistrado: true,
  tieneLlamadaConFecha: true, llamadaSucedio: true, areaDeclaradaId: "area",
  fechaLimitePago: "2026-10-15", valorVendidoUsd: 1000,
  abonosVigentes: 1, saldo: 0, motivoId: "motivo",
};
const FALTANTES_POR_ETAPA = {
  potencial: ["cohorte"], registrado: ["cohorte"], calificado: ["cohorte"],
  en_gestion: ["cohorte", "dueno"], contactado: ["cohorte", "dueno", "contacto"],
  agendado: ["cohorte", "dueno", "llamada_con_fecha"],
  atendido: ["cohorte", "dueno", "llamada_sucedio", "area_declarada"],
  compromiso_verbal: ["cohorte", "dueno", "area_declarada", "fecha_limite_pago"],
  ganado_parcial: ["cohorte", "dueno", "area_declarada", "valor_vendido", "abono", "fecha_limite_pago"],
  ganado_completo: ["cohorte", "dueno", "area_declarada", "valor_vendido", "abono", "saldo_en_cero"],
  cierre_perdido: ["motivo"],
} as const;

describe("propiedades acumuladas de la etapa", () => {
  for (const [etapa, esperados] of Object.entries(FALTANTES_POR_ETAPA)) {
    it(`${etapa}: lista las faltantes y queda vacío al completarlas`, () => {
      const vacias: PropiedadesDelDeal = {
        tieneCohorte: false, tieneDueno: false, tieneContactoRegistrado: false,
        tieneLlamadaConFecha: false, llamadaSucedio: false, areaDeclaradaId: null,
        fechaLimitePago: null, valorVendidoUsd: null, abonosVigentes: 0, saldo: null, motivoId: null,
      };
      expect(propiedadesQueLeFaltan(etapa as keyof typeof FALTANTES_POR_ETAPA, vacias).map((f) => f.codigo)).toEqual(esperados);
      expect(propiedadesQueLeFaltan(etapa as keyof typeof FALTANTES_POR_ETAPA, PROPIEDADES_COMPLETAS)).toEqual([]);
    });
  }

  it("no exime al histórico ni agrega comprobante", () => {
    const faltan = propiedadesQueLeFaltan("ganado_parcial", { ...PROPIEDADES_COMPLETAS, areaDeclaradaId: null, valorVendidoUsd: null });
    expect(faltan.map((f) => f.codigo)).toEqual(["area_declarada", "valor_vendido"]);
    expect(faltan.some((f) => (f.codigo as string) === "comprobante")).toBe(false);
  });
});

import "./142-nuevas-deal-requisitos";
