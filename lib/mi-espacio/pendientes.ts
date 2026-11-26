import type { Db } from "@/lib/db/tipos";
import { diaDeCalendario, sumarDias } from "@/lib/dias-habiles";
import {
  notificacionesCompletasDeChip,
  type ChipNotificacion,
  type NotificacionCompleta,
} from "@/lib/mi-espacio/notificaciones";

export const TIPOS_DE_PENDIENTE = [
  { tipo: "sin_resultado", chip: "sin_resultado", etiqueta: "Sin resultado", accion: "Marcar resultado", avisaJuanito: true },
  { tipo: "sin_comprobante", chip: "sin_comprobante", etiqueta: "Sin comprobante", accion: "Subir comprobante", avisaJuanito: true },
  { tipo: "sin_grain", chip: "sin_grain", etiqueta: "Sin Grain", accion: "Pegar enlace de Grain", avisaJuanito: true },
  { tipo: "vencidos", chip: "vencidos", etiqueta: "Vencido", accion: "Abrir deal", avisaJuanito: true },
  { tipo: "reagenda", chip: "reagenda", etiqueta: "Por reagendar", accion: "Reagendar", avisaJuanito: true },
  { tipo: "nuevos", chip: "nuevos", etiqueta: "Nuevo", accion: "Abrir deal", avisaJuanito: true },
  { tipo: "seguimiento", chip: "seguimiento", etiqueta: "Seguimiento", accion: "Abrir deal", avisaJuanito: false },
  { tipo: "calendly", chip: "calendly", etiqueta: "Cambio en Calendly", accion: "Abrir deal", avisaJuanito: false },
] as const satisfies readonly {
  tipo: ChipNotificacion;
  chip: ChipNotificacion;
  etiqueta: string;
  accion: string;
  avisaJuanito: boolean;
}[];

export type TipoDePendiente = (typeof TIPOS_DE_PENDIENTE)[number]["tipo"];
export type GrupoDePendiente = "vencido" | "hoy" | "proximo";

export const DIAS_MAXIMOS_DE_AVISO = 7;
const CHIPS_CON_TOPE_DE_ANTIGUEDAD: readonly TipoDePendiente[] = ["sin_grain", "reagenda", "nuevos"];

export interface PendienteDelCloser {
  dealId: string;
  leadId: string;
  leadNombre: string | null;
  leadEmail: string;
  tipo: TipoDePendiente;
  fechaClave: Date | string | null;
  grupo: GrupoDePendiente;
  creadoEn: Date;
  detalle?: "seguimiento" | "compromiso" | "cartera";
}

export function grupoDePendiente(fechaClave: Date | string | null, dia: string): GrupoDePendiente {
  const diaClave = fechaClave instanceof Date ? diaDeCalendario(fechaClave) : fechaClave;
  if (diaClave == null || diaClave === dia) return "hoy";
  return diaClave < dia ? "vencido" : "proximo";
}

export function tipoDePendientePedido(valor: string | undefined): TipoDePendiente | null {
  return TIPOS_DE_PENDIENTE.some((tipo) => tipo.tipo === valor)
    ? valor as TipoDePendiente
    : null;
}

function fechaComoDate(notificacion: NotificacionCompleta): Date {
  if (notificacion.fechaClave instanceof Date) return notificacion.fechaClave;
  if (typeof notificacion.fechaClave === "string") return new Date(`${notificacion.fechaClave}T12:00:00-05:00`);
  return notificacion.tarjeta.creadoEn;
}

function detalleVencido(notificacion: NotificacionCompleta): PendienteDelCloser["detalle"] {
  if (notificacion.tarjeta.avisos.seguimientoVencido) return "seguimiento";
  if (notificacion.tarjeta.avisos.compromisoVencido) return "compromiso";
  return "cartera";
}

export async function pendientesDelCloserEnPrograma(
  db: Db,
  entrada: {
    programId: string;
    userId: string;
    dia: string;
    ahora: Date;
    soloAvisos?: boolean;
  },
): Promise<{ filas: PendienteDelCloser[]; citasAntiguas: number }> {
  const tipos = entrada.soloAvisos
    ? TIPOS_DE_PENDIENTE.filter((tipo) => tipo.avisaJuanito)
    : TIPOS_DE_PENDIENTE;
  const limiteSeguimiento = sumarDias(entrada.dia, 6);
  const mediodia = new Date(`${entrada.dia}T12:00:00-05:00`).getTime();
  const filas: PendienteDelCloser[] = [];
  let citasAntiguas = 0;

  for (const registro of tipos) {
    const notificaciones = await notificacionesCompletasDeChip(
      db,
      { programId: entrada.programId, userId: entrada.userId, chip: registro.chip },
      entrada.dia,
      entrada.ahora,
    );
    for (const notificacion of notificaciones) {
      if (notificacion.tarjeta.etapa === "cierre_perdido") continue;
      if (registro.tipo === "seguimiento" && (typeof notificacion.fechaClave !== "string" || notificacion.fechaClave > limiteSeguimiento)) continue;

      const fecha = fechaComoDate(notificacion);
      const antiguedad = Math.floor((mediodia - fecha.getTime()) / 86_400_000);
      if (CHIPS_CON_TOPE_DE_ANTIGUEDAD.includes(registro.tipo) && antiguedad > DIAS_MAXIMOS_DE_AVISO) continue;
      if (registro.tipo === "sin_resultado" && antiguedad > DIAS_MAXIMOS_DE_AVISO) {
        citasAntiguas += 1;
        continue;
      }

      filas.push({
        dealId: notificacion.tarjeta.dealId,
        leadId: notificacion.tarjeta.leadId,
        leadNombre: notificacion.tarjeta.nombreLead,
        leadEmail: notificacion.tarjeta.emailLead,
        tipo: registro.tipo,
        fechaClave: notificacion.fechaClave,
        grupo: grupoDePendiente(notificacion.fechaClave, entrada.dia),
        creadoEn: notificacion.tarjeta.creadoEn,
        ...(registro.tipo === "vencidos" ? { detalle: detalleVencido(notificacion) } : {}),
      });
    }
  }

  return { filas, citasAntiguas };
}
