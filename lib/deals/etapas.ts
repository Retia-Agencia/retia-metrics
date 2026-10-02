import {
  etapaDealEnum,
  pendienteDealEnum,
  tipoMotivoEnum,
  type EtapaDeal,
} from "@/lib/db/schema";

export type { EtapaDeal };
export type PendienteDeal = (typeof pendienteDealEnum.enumValues)[number];
export type TipoMotivo = (typeof tipoMotivoEnum.enumValues)[number];
export type QuienMueve = "sistema" | "closer" | "ambos";

export const ETAPAS: readonly EtapaDeal[] = etapaDealEnum.enumValues;
export const PENDIENTES: readonly PendienteDeal[] = pendienteDealEnum.enumValues;
export const ETAPAS_EN_ORDEN: readonly EtapaDeal[] = [
  "potencial", "registrado", "en_gestion", "contactado", "calificado", "agendado",
  "atendido", "compromiso_verbal", "ganado_parcial", "ganado_completo", "cierre_perdido",
];
export const ETAPAS_DE_SETTEO: readonly EtapaDeal[] = [
  "potencial", "registrado", "en_gestion", "contactado", "calificado",
];
export const ETAPAS_VENDIDAS: readonly EtapaDeal[] = ["ganado_parcial", "ganado_completo"];

export const NOMBRE_DE_ETAPA: Readonly<Record<EtapaDeal, string>> = {
  potencial: "Potencial", registrado: "Registrado", en_gestion: "En gestión",
  contactado: "Contactado", calificado: "Calificado", agendado: "Agendado",
  atendido: "Atendido", compromiso_verbal: "Compromiso Verbal",
  ganado_parcial: "Ganado Pago Parcial", ganado_completo: "Ganado Pagado Completo",
  cierre_perdido: "Cierre perdido",
};
export const NOMBRE_DE_PENDIENTE: Readonly<Record<PendienteDeal, string>> = {
  reagenda: "Re-agenda", seguimiento: "Seguimiento", proxima_cohorte: "Próxima Cohorte",
};

export interface FlechaBase {
  readonly id: string;
  readonly quien: QuienMueve;
  readonly exigeMotivo: boolean;
  readonly tipoDeMotivo: TipoMotivo | null;
}
export interface Transicion extends FlechaBase {
  readonly tipo: "etapa";
  readonly de: EtapaDeal;
  readonly a: EtapaDeal;
  readonly soloConPendiente: boolean;
}
export interface TransicionPendiente extends FlechaBase {
  readonly tipo: "pendiente";
  readonly etapa: EtapaDeal;
  readonly pone: PendienteDeal | null;
}

type FilaEtapa = readonly [string, EtapaDeal | readonly EtapaDeal[], EtapaDeal | readonly EtapaDeal[], QuienMueve,
  { motivo?: TipoMotivo; soloConPendiente?: boolean }?];
type FilaPendiente = readonly [string, EtapaDeal | readonly EtapaDeal[], PendienteDeal, QuienMueve, TipoMotivo?];

const SE_PUEDEN_PERDER: readonly EtapaDeal[] = [
  "potencial", "registrado", "en_gestion", "contactado", "calificado", "agendado",
  "atendido", "compromiso_verbal", "ganado_parcial",
];
const FILAS_ETAPA: readonly FilaEtapa[] = [
  ["S1", "potencial", "registrado", "sistema"],
  ["S2", "potencial", "calificado", "sistema"],
  ["S3", "registrado", "calificado", "sistema"],
  ["E1", ["potencial", "registrado"], "en_gestion", "sistema"],
  ["E2", "en_gestion", "contactado", "sistema"],
  ["E3", ["en_gestion", "contactado"], "calificado", "closer"],
  ["E4", ETAPAS_DE_SETTEO, "agendado", "ambos"],
  ["E5", ["contactado", "calificado"], "compromiso_verbal", "closer"],
  ["E6", ["contactado", "calificado"], ["ganado_parcial", "ganado_completo"], "sistema"],
  ["E7", "agendado", "agendado", "ambos"],
  ["E8", "agendado", "atendido", "ambos"],
  ["E9", "atendido", "agendado", "ambos", { soloConPendiente: true }],
  ["E10", "atendido", "compromiso_verbal", "closer"],
  ["E11", "atendido", ["ganado_parcial", "ganado_completo"], "sistema"],
  ["E12", "compromiso_verbal", ["ganado_parcial", "ganado_completo"], "sistema"],
  ["E13", "ganado_parcial", "ganado_completo", "sistema"],
  ["RETRO", "compromiso_verbal", ["atendido", "contactado", "calificado"], "closer", { motivo: "retroceso" }],
  ["P", SE_PUEDEN_PERDER, "cierre_perdido", "closer", { motivo: "perdida" }],
  ["R", "cierre_perdido", ["en_gestion", "agendado"], "closer", { motivo: "recuperacion" }],
  ["A1", "ganado_parcial", ["contactado", "calificado", "atendido", "compromiso_verbal"], "sistema"],
  ["A2", "ganado_completo", "ganado_parcial", "sistema"],
];
const FILAS_PENDIENTE: readonly FilaPendiente[] = [
  ["PR1", "agendado", "reagenda", "sistema"],
  ["PR2", "atendido", "reagenda", "closer", "reagenda"],
  ["PS1", "atendido", "seguimiento", "closer"],
  ["PS2", "calificado", "seguimiento", "closer"],
  ["PS3", "compromiso_verbal", "seguimiento", "closer"],
  ["PC", ["potencial", "registrado", "en_gestion", "contactado", "calificado", "atendido", "compromiso_verbal", "agendado"], "proxima_cohorte", "closer"],
];

const comoLista = <T>(valor: T | readonly T[]): readonly T[] => Array.isArray(valor) ? valor as readonly T[] : [valor as T];
export const TRANSICIONES: readonly Transicion[] = FILAS_ETAPA.flatMap(([id, de, a, quien, opciones]) =>
  comoLista(de).flatMap((origen) => comoLista(a).map((destino) => ({
    tipo: "etapa" as const, id, de: origen, a: destino, quien,
    exigeMotivo: opciones?.motivo != null, tipoDeMotivo: opciones?.motivo ?? null,
    soloConPendiente: opciones?.soloConPendiente ?? false,
  }))),
);
export const TRANSICIONES_PENDIENTE: readonly TransicionPendiente[] = FILAS_PENDIENTE.flatMap(
  ([id, etapa, pone, quien, motivo]) => comoLista(etapa).map((e) => ({
    tipo: "pendiente" as const, id, etapa: e, pone, quien,
    exigeMotivo: motivo != null, tipoDeMotivo: motivo ?? null,
  })),
);

const claveEtapa = (de: EtapaDeal, a: EtapaDeal) => `${de}>${a}`;
const clavePendiente = (etapa: EtapaDeal, pone: PendienteDeal | null) => `${etapa}>${pone ?? "null"}`;
const INDICE_ETAPA = new Map<string, Transicion>();
for (const t of TRANSICIONES) {
  const clave = claveEtapa(t.de, t.a);
  if (INDICE_ETAPA.has(clave)) throw new Error(`Transición duplicada ${t.de} → ${t.a}.`);
  INDICE_ETAPA.set(clave, t);
}
const INDICE_PENDIENTE = new Map<string, TransicionPendiente>();
for (const t of TRANSICIONES_PENDIENTE) {
  const clave = clavePendiente(t.etapa, t.pone);
  if (INDICE_PENDIENTE.has(clave)) throw new Error(`Transición de pendiente duplicada ${t.etapa} → ${t.pone}.`);
  INDICE_PENDIENTE.set(clave, t);
}

export function transicion(de: EtapaDeal, a: EtapaDeal): Transicion | null {
  return INDICE_ETAPA.get(claveEtapa(de, a)) ?? null;
}
export function transicionPendiente(etapa: EtapaDeal, pone: PendienteDeal): TransicionPendiente | null {
  return INDICE_PENDIENTE.get(clavePendiente(etapa, pone)) ?? null;
}
export function transicionRetomar(etapa: EtapaDeal, pendiente: PendienteDeal | null): TransicionPendiente | null {
  if (pendiente !== "proxima_cohorte") return null;
  return { tipo: "pendiente", id: "RET", etapa, pone: null, quien: "sistema", exigeMotivo: false, tipoDeMotivo: null };
}
export function unaCitaMueveAAgendado(etapa: EtapaDeal, pendiente: PendienteDeal | null): boolean {
  return ETAPAS_DE_SETTEO.includes(etapa) || ((etapa === "agendado" || etapa === "atendido") && pendiente != null);
}
export function esTransicionPermitida(de: EtapaDeal, a: EtapaDeal): boolean { return INDICE_ETAPA.has(claveEtapa(de, a)); }
export function siguientesDe(de: EtapaDeal): EtapaDeal[] { return ETAPAS.filter((a) => esTransicionPermitida(de, a)); }
