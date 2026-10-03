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
export interface PropiedadesDelDeal {
  tieneCohorte: boolean;
  tieneDueno: boolean;
  tieneContactoRegistrado: boolean;
  tieneLlamadaConFecha: boolean;
  llamadaSucedio: boolean;
  areaDeclaradaId: string | null;
  fechaLimitePago: string | null;
  valorVendidoUsd: number | null;
  abonosVigentes: number;
  saldo: number | null;
  motivoId: string | null;
}
export type CodigoRequisito =
  | "transicion_no_permitida" | "cohorte" | "dueno" | "actividad" | "contacto"
  | "llamada_con_fecha" | "llamada_sucedio" | "llamada_fallida"
  | "valor_vendido" | "area_declarada" | "fecha_limite_pago" | "cohorte_destino"
  | "fecha_seguimiento" | "abono" | "saldo_pendiente"
  | "saldo_en_cero" | "sin_abonos" | "motivo";
export interface RequisitoFaltante { codigo: CodigoRequisito; mensaje: string }
type CodigoReal = Exclude<CodigoRequisito, "transicion_no_permitida">;

/** Lo que dice la pantalla cuando el requisito falta. */
export const MENSAJES: Record<CodigoReal, string> = {
  cohorte: "El deal no tiene cohorte.",
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
type HechosEvaluables = PropiedadesDelDeal & Partial<HechosDelDeal>;
const CUMPLE: Record<CodigoReal, (h: HechosEvaluables, eximirHistorico?: boolean) => boolean> = {
  cohorte: (h) => h.tieneCohorte,
  dueno: (h) => h.tieneDueno,
  actividad: (h) => h.tieneActividadComercial === true,
  contacto: (h) => h.tieneContactoRegistrado,
  llamada_con_fecha: (h) => h.tieneLlamadaConFecha,
  llamada_sucedio: (h) => h.llamadaSucedio,
  llamada_fallida: (h) => h.llamadaFallida === true,
  valor_vendido: (h, eximir) => (h.valorVendidoUsd ?? 0) > 0 || (eximir === true && h.esHistorico === true),
  area_declarada: (h, eximir) => h.areaDeclaradaId != null || (eximir === true && h.esHistorico === true),
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
  let requisitos: CodigoReal[];
  switch (t.id) {
    case "S1": case "S2": case "S3": requisitos = []; break;
    case "E1": requisitos = ["dueno", "actividad"]; break;
    case "E2": case "E3": case "PS2": requisitos = ["contacto"]; break;
    case "E4": case "E7": case "E9": requisitos = ["llamada_con_fecha"]; break;
    case "E5": case "E10": requisitos = ["fecha_limite_pago", "area_declarada"]; break;
    case "E6": case "E11": case "E12": requisitos = [...segunDestino((t as Transicion).a), "area_declarada"]; break;
    case "E8": requisitos = ["llamada_sucedio"]; break;
    case "E13": requisitos = ["valor_vendido", "saldo_en_cero", "area_declarada"]; break;
    case "RETRO": requisitos = ["fecha_seguimiento"]; break;
    case "R": requisitos = []; break;
    case "A1": requisitos = ["sin_abonos"]; break;
    case "A2": requisitos = ["saldo_pendiente"]; break;
    case "PR1": requisitos = ["llamada_fallida"]; break;
    case "PS1": case "PS3": requisitos = ["fecha_seguimiento"]; break;
    case "PC": requisitos = ["cohorte_destino"]; break;
    case "RET": requisitos = ["contacto"]; break;
    default: requisitos = [];
  }
  // El área se pide al contestar "¿Cómo terminó?" (143): toda salida de Atendido, menos E9,
  // que es la cita nueva moviendo el deal sola (Calendly, sin nadie a quien preguntar). La
  // respuesta que lleva ahí, la Re-agenda (PR2), ya la pidió.
  const saleDeAtendido = t.tipo === "etapa" ? t.de === "atendido" && t.id !== "E9" : t.etapa === "atendido";
  return saleDeAtendido && !requisitos.includes("area_declarada") ? [...requisitos, "area_declarada"] : requisitos;
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
    return !CUMPLE[c](hechos as HechosEvaluables, true);
  }).map((codigo) => ({ codigo, mensaje: MENSAJES[codigo] }));
}

const PROPIEDADES_POR_ETAPA: Record<EtapaDeal, CodigoReal[]> = {
  potencial: ["cohorte"], registrado: ["cohorte"], calificado: ["cohorte"],
  en_gestion: ["cohorte", "dueno"],
  contactado: ["cohorte", "dueno", "contacto"],
  agendado: ["cohorte", "dueno", "llamada_con_fecha"],
  atendido: ["cohorte", "dueno", "llamada_sucedio", "area_declarada"],
  compromiso_verbal: ["cohorte", "dueno", "area_declarada", "fecha_limite_pago"],
  ganado_parcial: ["cohorte", "dueno", "area_declarada", "valor_vendido", "abono", "fecha_limite_pago"],
  ganado_completo: ["cohorte", "dueno", "area_declarada", "valor_vendido", "abono", "saldo_en_cero"],
  cierre_perdido: ["motivo"],
};

export function propiedadesQueLeFaltan(etapa: EtapaDeal, hechos: PropiedadesDelDeal): RequisitoFaltante[] {
  return PROPIEDADES_POR_ETAPA[etapa]
    .filter((codigo) => !CUMPLE[codigo](hechos))
    .map((codigo) => ({ codigo, mensaje: MENSAJES[codigo] }));
}
export function queLeFalta(de: EtapaDeal, a: EtapaDeal, hechos: HechosDelDeal): RequisitoFaltante[] {
  const t = transicion(de, a);
  if (!t) return [{ codigo: "transicion_no_permitida", mensaje: `Un deal no puede pasar de ${NOMBRE_DE_ETAPA[de]} a ${NOMBRE_DE_ETAPA[a]}.` }];
  return queLeFaltaTransicion(t, hechos);
}
