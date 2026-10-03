import type { calls } from "@/lib/db/schema";
import { fechaHoraEnBogota } from "@/lib/format";

type Resultado = (typeof calls.$inferSelect)["resultado"];

export const ETIQUETA_DE_RESULTADO: Record<Resultado, string> = {
  agendada: "Agendada",
  show: "Show",
  no_show: "No show",
  cancelada: "Cancelada",
  reagendada: "Reagendada",
  compromiso_pago: "Compromiso de pago",
  cerrada: "Cerrada",
  perdida: "Perdida",
};

export const TONO_DE_RESULTADO: Record<
  Resultado,
  "neutro" | "info" | "alerta" | "exito" | "peligro"
> = {
  agendada: "info",
  show: "exito",
  no_show: "peligro",
  cancelada: "alerta",
  reagendada: "alerta",
  compromiso_pago: "alerta",
  cerrada: "exito",
  perdida: "peligro",
};

export function etiquetaDeOrigen(origen: string): string {
  if (origen === "calendly") return "Calendly";
  if (origen === "crm") return "Manual";
  if (origen === "sheets") return "Hoja";
  return origen;
}

const CAMPO_CANONICO: Record<string, string> = {
  program_id: "programId",
  cohort_id: "cohortId",
  huella_fila: "huellaFila",
  origen_id: "origenId",
  fecha_agenda: "fechaAgenda",
  fecha_llamada: "fechaLlamada",
  fecha_seguimiento: "fechaSeguimiento",
  closer_user_id: "closerUserId",
  closer_id: "closerId",
  deal_id: "dealId",
  link_calendly: "linkCalendly",
  link_grain: "linkGrain",
  email_lead: "emailLead",
  calendly_host_email: "calendlyHostEmail",
  motivo_id: "motivoId",
  motivo_perdida: "motivoPerdida",
  anulado_en: "anuladoEn",
  anulado_por: "anuladoPor",
  motivo_anulacion: "motivoAnulacion",
};

const ETIQUETA_DE_CAMPO: Record<string, string> = {
  resultado: "Estado",
  fechaAgenda: "Cita",
  fechaLlamada: "Ocurrió",
  fechaSeguimiento: "Seguimiento",
  closerUserId: "Closer",
  closerId: "Closer (hoja)",
  dealId: "Deal",
  linkCalendly: "Link de la reunión",
  linkGrain: "Grain",
  notas: "Notas",
  emailLead: "Correo",
  calendlyHostEmail: "Host de Calendly",
  origen: "Origen",
  motivoId: "Motivo",
  motivoPerdida: "Motivo",
  anuladoEn: "Anulada",
  anuladoPor: "Anulada por",
  motivoAnulacion: "Motivo de anulación",
};

const CAMPOS_OCULTOS = new Set(["programId", "cohortId", "huellaFila", "raw", "origenId"]);
const CAMPOS_FECHA = new Set(["fechaAgenda", "fechaLlamada", "fechaSeguimiento", "anuladoEn"]);
const CAMPOS_CON_NOMBRE = new Set(["closerUserId", "anuladoPor", "motivoId"]);

export function cambioLegible(
  cambio: { campo: string; valorAnterior: string | null; valorNuevo: string | null },
  nombres: Record<string, string>,
): { etiqueta: string; anterior: string | null; nuevo: string | null } | null {
  const campo = CAMPO_CANONICO[cambio.campo] ?? cambio.campo;
  if (CAMPOS_OCULTOS.has(campo)) return null;

  const valorLegible = (valor: string | null): string | null => {
    if (valor == null) return null;
    if (campo === "resultado") return ETIQUETA_DE_RESULTADO[valor as Resultado] ?? valor;
    if (campo === "origen") return etiquetaDeOrigen(valor);
    if (CAMPOS_FECHA.has(campo)) {
      const fecha = new Date(valor);
      return Number.isNaN(fecha.getTime()) ? valor : fechaHoraEnBogota(fecha);
    }
    if (CAMPOS_CON_NOMBRE.has(campo)) return nombres[valor] ?? "—";
    if (campo === "dealId") return "Asignada a un deal";
    return valor;
  };

  return {
    etiqueta: ETIQUETA_DE_CAMPO[campo] ?? cambio.campo,
    anterior: valorLegible(cambio.valorAnterior),
    nuevo: valorLegible(cambio.valorNuevo),
  };
}

export function citaActiva<
  T extends { id: string; resultado: Resultado; anuladoEn: Date | null; fechaAgenda: Date | null },
>(llamadas: T[]): string | null {
  const activa = llamadas
    .filter((llamada) => llamada.anuladoEn == null && llamada.resultado === "agendada")
    .sort((a, b) => (b.fechaAgenda?.getTime() ?? Number.NEGATIVE_INFINITY) - (a.fechaAgenda?.getTime() ?? Number.NEGATIVE_INFINITY))[0];
  return activa?.id ?? null;
}
