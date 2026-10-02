import { NOMBRE_DE_ETAPA, transicion, type EtapaDeal, type PendienteDeal, type Transicion, type TransicionPendiente } from "./etapas";

export interface HechosDelDeal {
  tieneDueno: boolean;
  tieneActividadComercial: boolean;
  tieneContactoRegistrado: boolean;
  pendienteActual: PendienteDeal | null;
  tieneLlamadaConFecha: boolean;
  llamadaSucedio: boolean;
  llamadaFallida: boolean;
  valorVendidoUsd: number | null;
  areaDeclaradaId: string | null;
  esHistorico: boolean;
  fechaLimitePago: string | null;
  cohorteDestinoId: string | null;
  fechaInicioVentasCohorteDestino: string | null;
  fechaUltimoContacto: Date | null;
  fechaSeguimiento: string | null;
  abonosVigentes: number;
  saldo: number | null;
  motivoId: string | null;
}
export type CodigoRequisito =
  | "transicion_no_permitida" | "dueno" | "actividad" | "contacto"
  | "llamada_con_fecha" | "llamada_sucedio" | "llamada_fallida"
  | "valor_vendido" | "area_declarada" | "fecha_limite_pago" | "cohorte_destino"
  | "fecha_seguimiento" | "abono" | "saldo_pendiente"
  | "saldo_en_cero" | "sin_abonos" | "motivo";
export interface RequisitoFaltante { codigo: CodigoRequisito; mensaje: string }
type CodigoReal = Exclude<CodigoRequisito, "transicion_no_permitida">;

/** Lo que dice la pantalla cuando el requisito falta. */
export const MENSAJES: Record<CodigoReal, string> = {
  dueno: "El deal no tiene dueño.",
  actividad: "Falta registrar una actividad: llamada, WhatsApp o correo.",
  contacto: "Falta registrar un contacto con el lead.",
  llamada_con_fecha: "Falta una llamada con fecha.",
  llamada_sucedio: "Falta el link de Grain de la llamada.",
  llamada_fallida: "La llamada no quedó en no-show ni cancelada.",
  valor_vendido: "Falta el valor vendido.",
  area_declarada: "Falta el área: ¿cómo nos conoció?",
  fecha_limite_pago: "Falta la fecha límite de pago.",
  cohorte_destino: "Falta la cohorte a la que quiere entrar.",
  fecha_seguimiento: "Falta la fecha de seguimiento.",
  abono: "Falta registrar un abono.",
  saldo_pendiente: "El saldo ya está en cero: el deal va a Ganado Pagado Completo, no a Ganado Pago Parcial.",
  saldo_en_cero: "Todavía queda saldo por pagar.",
  sin_abonos: "El deal todavía tiene abonos vigentes.",
  motivo: "Falta el motivo.",
};
const CUMPLE: Record<CodigoReal, (h: HechosDelDeal) => boolean> = {
  dueno: (h) => h.tieneDueno,
  actividad: (h) => h.tieneActividadComercial,
  contacto: (h) => h.tieneContactoRegistrado,
  llamada_con_fecha: (h) => h.tieneLlamadaConFecha,
  llamada_sucedio: (h) => h.llamadaSucedio,
  llamada_fallida: (h) => h.llamadaFallida,
  valor_vendido: (h) => (h.valorVendidoUsd ?? 0) > 0 || h.esHistorico,
  area_declarada: (h) => h.areaDeclaradaId != null || h.esHistorico,
  fecha_limite_pago: (h) => h.fechaLimitePago != null,
  cohorte_destino: (h) => h.cohorteDestinoId != null,
  fecha_seguimiento: (h) => h.fechaSeguimiento != null,
  abono: (h) => h.abonosVigentes > 0,
  saldo_pendiente: (h) => h.saldo != null && h.saldo > 0,
  saldo_en_cero: (h) => h.saldo != null && h.saldo <= 0,
  sin_abonos: (h) => h.abonosVigentes === 0,
  motivo: (h) => h.motivoId != null,
};

function requisitosDe(t: Transicion | TransicionPendiente): CodigoReal[] {
  const pago: CodigoReal[] = ["valor_vendido", "abono"];
  const segunDestino = (destino: EtapaDeal): CodigoReal[] =>
    destino === "ganado_parcial" ? [...pago, "saldo_pendiente"] : [...pago, "saldo_en_cero"];
  switch (t.id) {
    case "S1": case "S2": case "S3": return [];
    case "E1": return ["dueno", "actividad"];
    case "E2": case "E3": case "PS2": return ["contacto"];
    case "E4": case "E7": case "E9": return ["llamada_con_fecha"];
    case "E5": case "E10": return ["fecha_limite_pago", "area_declarada"];
    case "E6": case "E11": case "E12": return [...segunDestino((t as Transicion).a), "area_declarada"];
    case "E8": return ["llamada_sucedio"];
    case "E13": return ["valor_vendido", "saldo_en_cero", "area_declarada"];
    case "RETRO": return ["fecha_seguimiento"];
    case "R": return [];
    case "A1": return ["sin_abonos"];
    case "A2": return ["saldo_pendiente"];
    case "PR1": return ["llamada_fallida"];
    case "PS1": case "PS3": return ["fecha_seguimiento"];
    case "PC": return ["cohorte_destino"];
    case "RET": return ["contacto"];
    default: return [];
  }
}
export function requisitosDeTransicion(t: Transicion | TransicionPendiente): CodigoRequisito[] {
  const codigos: CodigoRequisito[] = [...requisitosDe(t)];
  if (t.exigeMotivo) codigos.push("motivo");
  return codigos;
}
export function queLeFaltaTransicion(t: Transicion | TransicionPendiente, hechos: HechosDelDeal): RequisitoFaltante[] {
  const codigos: CodigoReal[] = requisitosDe(t);
  if (t.exigeMotivo) codigos.push("motivo");
  return codigos.filter((c) => {
    if (t.id === "RET" && c === "contacto") {
      if (!hechos.fechaUltimoContacto || !hechos.fechaInicioVentasCohorteDestino) return true;
      const inicio = new Date(`${hechos.fechaInicioVentasCohorteDestino}T00:00:00-05:00`);
      return hechos.fechaUltimoContacto < inicio;
    }
    return !CUMPLE[c](hechos);
  }).map((codigo) => ({ codigo, mensaje: MENSAJES[codigo] }));
}
export function queLeFalta(de: EtapaDeal, a: EtapaDeal, hechos: HechosDelDeal): RequisitoFaltante[] {
  const t = transicion(de, a);
  if (!t) return [{ codigo: "transicion_no_permitida", mensaje: `Un deal no puede pasar de ${NOMBRE_DE_ETAPA[de]} a ${NOMBRE_DE_ETAPA[a]}.` }];
  return queLeFaltaTransicion(t, hechos);
}
