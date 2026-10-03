import { describe, expect, it } from "vitest";
import { TRANSICIONES, TRANSICIONES_PENDIENTE, transicionRetomar, type Transicion, type TransicionPendiente } from "@/lib/deals/etapas";
import { queLeFaltaTransicion, requisitosDeTransicion, type CodigoRequisito, type HechosDelDeal } from "@/lib/deals/requisitos";

type Codigo = Exclude<CodigoRequisito, "transicion_no_permitida" | "cohorte">;
const TODO: HechosDelDeal = {
  cortesia: false,
  tieneDueno: true, tieneActividadComercial: true, tieneContactoRegistrado: true,
  pendienteActual: null,
  tieneLlamadaConFecha: true, llamadaSucedio: true, llamadaFallida: true,
  valorVendidoUsd: 1000, areaDeclaradaId: "area", esHistorico: false,
  fechaLimitePago: "2026-10-20", cohorteDestinoId: "destino",
  fechaInicioVentasCohorteDestino: "2026-10-01", fechaUltimoContacto: new Date("2026-10-02T12:00:00-05:00"),
  fechaSeguimiento: "2026-10-20", abonosVigentes: 1,
  saldo: 100, motivoId: "motivo",
};
const ROMPER: Record<Codigo, Partial<HechosDelDeal>> = {
  dueno: { tieneDueno: false }, actividad: { tieneActividadComercial: false }, contacto: { tieneContactoRegistrado: false, fechaUltimoContacto: null },
  llamada_con_fecha: { tieneLlamadaConFecha: false }, llamada_sucedio: { llamadaSucedio: false }, llamada_fallida: { llamadaFallida: false },
  valor_vendido: { valorVendidoUsd: null }, area_declarada: { areaDeclaradaId: null }, fecha_limite_pago: { fechaLimitePago: null },
  cohorte_destino: { cohorteDestinoId: null }, fecha_seguimiento: { fechaSeguimiento: null }, abono: { abonosVigentes: 0 },
  saldo_pendiente: { saldo: 0 }, saldo_en_cero: { saldo: 100 },
  sin_abonos: { abonosVigentes: 1 }, motivo: { motivoId: null },
};

const clave = (t: Transicion | TransicionPendiente) =>
  ["E6", "E11", "E12"].includes(t.id) ? `${t.id}>${(t as Transicion).a}` : t.id;
const ESPERADOS: Record<string, Codigo[]> = {
  S1: [], S2: [], S3: [],
  E1: ["dueno", "actividad"], E2: ["contacto"], E3: ["contacto"], E4: ["llamada_con_fecha"],
  E5: ["fecha_limite_pago", "area_declarada"],
  "E6>ganado_parcial": ["valor_vendido", "abono", "saldo_pendiente", "area_declarada"],
  "E6>ganado_completo": ["valor_vendido", "abono", "saldo_en_cero", "area_declarada"],
  E7: ["llamada_con_fecha"], E8: ["llamada_sucedio"], E9: ["llamada_con_fecha"],
  E10: ["fecha_limite_pago", "area_declarada"],
  "E11>ganado_parcial": ["valor_vendido", "abono", "saldo_pendiente", "area_declarada"],
  "E11>ganado_completo": ["valor_vendido", "abono", "saldo_en_cero", "area_declarada"],
  "E12>ganado_parcial": ["valor_vendido", "abono", "saldo_pendiente", "area_declarada"],
  "E12>ganado_completo": ["valor_vendido", "abono", "saldo_en_cero", "area_declarada"],
  E13: ["valor_vendido", "saldo_en_cero", "area_declarada"],
  RETRO: ["fecha_seguimiento", "motivo"], P: ["motivo"], R: ["motivo"], A1: ["sin_abonos"], A2: ["saldo_pendiente"],
  PR1: ["llamada_fallida"], PR2: ["motivo"], PS1: ["fecha_seguimiento"],
  PS2: ["contacto"], PS3: ["fecha_seguimiento"], PC: ["cohorte_destino"], RET: ["contacto"],
};

describe("requisitos de cada flecha", () => {
  const ret = transicionRetomar("calificado", "proxima_cohorte")!;
  const flechas = [...TRANSICIONES, ...TRANSICIONES_PENDIENTE, ret];
  for (const t of flechas) {
    const base = ESPERADOS[clave(t)];
    // E9 es la cita nueva que mueve el deal sola: no pide área (143).
    const saleDeAtendido = t.tipo === "etapa" ? t.de === "atendido" && t.id !== "E9" : t.etapa === "atendido";
    const esperados = saleDeAtendido && !base.includes("area_declarada")
      ? [...base.filter((codigo) => codigo !== "motivo"), "area_declarada" as const, ...base.filter((codigo) => codigo === "motivo")]
      : base;
    it(`${t.id} tiene el contrato de requisitos esperado`, () => {
      expect(requisitosDeTransicion(t)).toEqual(esperados);
    });
    it(`${t.id} acepta sus requisitos cumplidos`, () => {
      const hechos = { ...TODO, saldo: esperados.includes("saldo_en_cero") ? 0 : 100, abonosVigentes: esperados.includes("sin_abonos") ? 0 : 1 };
      expect(queLeFaltaTransicion(t, hechos)).toEqual([]);
    });
    for (const codigo of esperados) {
      it(`${t.id} rechaza cuando falta ${codigo}`, () => {
        const hechos = { ...TODO, saldo: esperados.includes("saldo_en_cero") ? 0 : 100, abonosVigentes: esperados.includes("sin_abonos") ? 0 : 1, ...ROMPER[codigo] };
        expect(queLeFaltaTransicion(t, hechos).map((f) => f.codigo)).toContain(codigo);
      });
    }
  }

  it("RET rechaza un contacto anterior a la apertura de ventas", () => {
    const ret = transicionRetomar("atendido", "proxima_cohorte")!;
    expect(queLeFaltaTransicion(ret, { ...TODO, fechaUltimoContacto: new Date("2026-09-30T23:59:59-05:00") }).map((f) => f.codigo)).toEqual(["contacto"]);
  });
});
