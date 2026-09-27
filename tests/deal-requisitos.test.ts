import { describe, expect, it } from "vitest";
import { TRANSICIONES } from "@/lib/deals/etapas";
import { queLeFalta, type CodigoRequisito, type HechosDelDeal } from "@/lib/deals/requisitos";

/**
 * Ticket 044 — los requisitos de cada flecha, como predicados puros.
 *
 * `ESPERADOS` esta escrito a mano desde la columna "Requisito" de
 * `docs/structure.md` §3.1, no derivado del codigo. Para cada flecha se prueban
 * los dos sentidos: con todo cumplido pasa, y quitando UN requisito falla
 * nombrando exactamente ese.
 */
type Codigo = Exclude<CodigoRequisito, "transicion_no_permitida">;

const ESPERADOS: Record<string, Codigo[]> = {
  T1: ["dueno", "contacto"],
  T2: ["llamada_con_fecha"],
  T3: ["llamada_con_fecha"],
  T4: ["producto", "fecha_limite_pago"],
  "T5>abonado": ["producto", "abono", "comprobante", "saldo_pendiente"],
  "T5>completo": ["producto", "abono", "comprobante", "saldo_en_cero"],
  T6: ["llamada_con_fecha"],
  T7: ["llamada_sucedio"],
  T8: ["llamada_fallida"],
  T9: ["llamada_con_fecha"],
  T10: ["llamada_sucedio"],
  T12: ["producto", "fecha_limite_pago"],
  T13: ["producto", "abono", "comprobante", "saldo_pendiente"],
  T14: ["producto", "abono", "comprobante", "saldo_en_cero"],
  T15: ["motivo"],
  T16: ["producto", "abono", "comprobante", "saldo_pendiente"],
  T17: ["producto", "abono", "comprobante", "saldo_en_cero"],
  T18: ["saldo_en_cero"],
  T19: ["cohorte_destino"],
  T20: ["cohorte_destino"],
  T21: ["cohorte_destino"],
  T22: ["contacto"],
  T23: ["llamada_con_fecha"],
  T24: ["fecha_seguimiento"],
  T25: ["producto", "fecha_limite_pago"],
  "T26>abonado": ["producto", "abono", "comprobante", "saldo_pendiente"],
  "T26>completo": ["producto", "abono", "comprobante", "saldo_en_cero"],
  T27: ["llamada_con_fecha"],
  T28: ["cohorte_destino"],
  T29: ["motivo"],
  P: ["motivo"],
  R: ["motivo"],
  A1: ["sin_abonos", "motivo"],
  A2: ["saldo_pendiente", "motivo"],
};

/** Un deal que no cumple nada. */
const NADA: HechosDelDeal = {
  tieneDueno: false,
  tieneContactoRegistrado: false,
  tieneLlamadaConFecha: false,
  llamadaSucedio: false,
  llamadaFallida: false,
  productoId: null,
  fechaLimitePago: null,
  cohorteDestinoId: null,
  fechaSeguimiento: null,
  abonosVigentes: 0,
  abonoConComprobante: false,
  saldo: null,
  motivo: null,
};

/** Como se CUMPLE cada requisito, y como se ROMPE partiendo de un deal que si lo cumplia. */
const CUMPLIR: Record<Codigo, Partial<HechosDelDeal>> = {
  dueno: { tieneDueno: true },
  contacto: { tieneContactoRegistrado: true },
  llamada_con_fecha: { tieneLlamadaConFecha: true },
  llamada_sucedio: { llamadaSucedio: true },
  llamada_fallida: { llamadaFallida: true },
  producto: { productoId: "prod-1" },
  fecha_limite_pago: { fechaLimitePago: "2026-10-15" },
  cohorte_destino: { cohorteDestinoId: "coh-2" },
  fecha_seguimiento: { fechaSeguimiento: "2026-10-01" },
  abono: { abonosVigentes: 1 },
  comprobante: { abonoConComprobante: true },
  saldo_pendiente: { saldo: 300 },
  saldo_en_cero: { saldo: 0 },
  sin_abonos: { abonosVigentes: 0 },
  motivo: { motivo: "no contesta" },
};

const ROMPER: Record<Codigo, Partial<HechosDelDeal>> = {
  dueno: { tieneDueno: false },
  contacto: { tieneContactoRegistrado: false },
  llamada_con_fecha: { tieneLlamadaConFecha: false },
  llamada_sucedio: { llamadaSucedio: false },
  llamada_fallida: { llamadaFallida: false },
  producto: { productoId: null },
  fecha_limite_pago: { fechaLimitePago: null },
  cohorte_destino: { cohorteDestinoId: null },
  fecha_seguimiento: { fechaSeguimiento: null },
  abono: { abonosVigentes: 0 },
  comprobante: { abonoConComprobante: false },
  saldo_pendiente: { saldo: 0 },
  saldo_en_cero: { saldo: 300 },
  sin_abonos: { abonosVigentes: 1 },
  motivo: { motivo: "   " },
};

const cumpliendo = (codigos: Codigo[]): HechosDelDeal =>
  Object.assign({}, NADA, ...codigos.map((c) => CUMPLIR[c]));

const claveDe = (t: (typeof TRANSICIONES)[number]) => (ESPERADOS[t.id] ? t.id : `${t.id}>${t.a}`);

describe("los requisitos de cada flecha (structure.md §3.1)", () => {
  it("cada flecha de la tabla tiene sus requisitos escritos en este test", () => {
    for (const t of TRANSICIONES) expect(ESPERADOS[claveDe(t)], `${t.id} ${t.de} → ${t.a}`).toBeDefined();
  });

  for (const t of TRANSICIONES) {
    const esperados = ESPERADOS[claveDe(t)] ?? [];

    it(`${t.id} ${t.de} → ${t.a}: con todo cumplido pasa`, () => {
      expect(queLeFalta(t.de, t.a, cumpliendo(esperados))).toEqual([]);
    });

    for (const codigo of esperados) {
      it(`${t.id} ${t.de} → ${t.a}: sin "${codigo}" falla nombrandolo`, () => {
        const hechos = { ...cumpliendo(esperados), ...ROMPER[codigo] };
        const falta = queLeFalta(t.de, t.a, hechos);
        expect(falta.map((f) => f.codigo)).toEqual([codigo]);
        expect(falta[0].mensaje).toMatch(/\S/);
      });
    }
  }
});

describe("lo que no es un requisito", () => {
  it("una flecha que no existe se rechaza con las etapas por su nombre", () => {
    const falta = queLeFalta("pendiente_setteo", "completo", cumpliendo(["producto", "abono", "saldo_en_cero"]));
    expect(falta).toEqual([
      { codigo: "transicion_no_permitida", mensaje: "Un deal no puede pasar de Pendiente Setteo a Completo." },
    ]);
  });

  it("devuelve TODO lo que falta, no solo lo primero", () => {
    expect(queLeFalta("atendido", "abonado", NADA).map((f) => f.codigo)).toEqual([
      "producto",
      "abono",
      "comprobante",
      "saldo_pendiente",
    ]);
  });

  it("un deal sin producto no tiene saldo contra el cual ir a Completo", () => {
    const hechos = { ...cumpliendo(["abono", "comprobante"]), saldo: null };
    expect(queLeFalta("abonado", "completo", hechos).map((f) => f.codigo)).toEqual(["saldo_en_cero"]);
  });

  it("un sobrepago que se colo cuenta como pagado: el deal no queda trabado en Abonado", () => {
    const hechos = { ...cumpliendo(["abono"]), saldo: -50 };
    expect(queLeFalta("abonado", "completo", hechos)).toEqual([]);
  });
});
