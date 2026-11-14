import type { VentanaPendientes } from "./contrato";

export type TipoPendienteCloser = "sin_resultado" | "sin_grain" | "reagenda" | "vencidos" | "nuevos";

export interface PendienteDeDeal {
  tipo: TipoPendienteCloser;
  fecha: Date | string | null;
  detalle?: "seguimiento" | "compromiso" | "cartera";
}

export interface DealConPendientes {
  dealId: string;
  nombreLead: string;
  programa: string;
  etapa: string;
  fechaUrgencia: Date;
  pendientes: PendienteDeDeal[];
}

export interface DatosTextoPendientes {
  nombreCloser: string;
  ventana: VentanaPendientes;
  dia: string;
  deals: DealConPendientes[];
  citasAntiguas: number;
  enlace: string;
}

const DIA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "2-digit", month: "short" });
const HORA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false });

function fechaComoDate(fecha: Date | string | null): Date | null {
  if (fecha === null) return null;
  return fecha instanceof Date ? fecha : new Date(`${fecha}T12:00:00-05:00`);
}

function diasDesde(fecha: Date | string | null, dia: string): number {
  const valor = fechaComoDate(fecha);
  if (!valor) return 0;
  const fin = new Date(`${dia}T12:00:00-05:00`);
  return Math.max(0, Math.floor((fin.getTime() - valor.getTime()) / 86_400_000));
}

function fechaCorta(fecha: Date | string | null): string {
  const valor = fechaComoDate(fecha);
  if (!valor) return "fecha pendiente";
  return DIA.format(valor).replaceAll(".", "").replace(" de ", "-");
}

function antiguedad(fecha: Date | string | null, dia: string): string {
  const dias = diasDesde(fecha, dia);
  return dias > 3 ? ` (lleva ${dias} días)` : "";
}

function vineta(pendiente: PendienteDeDeal, dia: string): string {
  switch (pendiente.tipo) {
    case "sin_resultado":
      return `Cita del ${fechaCorta(pendiente.fecha)} sin resultado${antiguedad(pendiente.fecha, dia)}`;
    case "sin_grain":
      return `Llamada hecha sin link de Grain${antiguedad(pendiente.fecha, dia)}`;
    case "reagenda":
      return `Re-agenda pendiente${antiguedad(pendiente.fecha, dia)}`;
    case "vencidos": {
      const nombre = pendiente.detalle === "compromiso" ? "Compromiso de pago"
        : pendiente.detalle === "cartera" ? "Cartera" : "Seguimiento";
      return `${nombre} vencido desde el ${fechaCorta(pendiente.fecha)}${antiguedad(pendiente.fecha, dia)}`;
    }
    case "nuevos":
      return `Deal asignado todavía sin abrir${antiguedad(pendiente.fecha, dia)}`;
  }
}

function nombreDePila(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] || "Hola";
}

function textoDeLaTarde(datos: DatosTextoPendientes): string {
  const citas = datos.deals.flatMap((deal) => deal.pendientes
    .filter((p) => p.tipo === "sin_resultado")
    .map((p) => `${deal.nombreLead} (${fechaComoDate(p.fecha) ? HORA.format(fechaComoDate(p.fecha)!) : "—"})`));
  const sinGrain = datos.deals.flatMap((deal) => deal.pendientes
    .filter((p) => p.tipo === "sin_grain")
    .map(() => deal.nombreLead));
  const lineas: string[] = [];
  if (citas.length > 0) {
    lineas.push(`${nombreDePila(datos.nombreCloser)}, hoy tuviste ${citas.length} ${citas.length === 1 ? "cita que sigue" : "citas que siguen"} sin resultado: ${citas.join(", ")}.`);
  }
  if (sinGrain.length > 0) {
    lineas.push(`${sinGrain.length === 1 ? "Una llamada de hoy sigue" : `${sinGrain.length} llamadas de hoy siguen`} sin link de Grain: ${sinGrain.join(", ")}.`);
  }
  lineas.push(`Márcalas aquí: ${datos.enlace}`);
  return lineas.join("\n");
}

/** Texto plano que Juanito manda tal cual, sin completar nombres ni datos de contacto. */
export function textoDePendientesDeCloser(datos: DatosTextoPendientes): string {
  if (datos.ventana === "tarde") return textoDeLaTarde(datos);
  const mostrados = datos.deals.slice(0, 8);
  const registros = datos.deals.reduce((n, deal) => n + deal.pendientes.length, 0);
  const lineas = [
    `${nombreDePila(datos.nombreCloser)}, te faltan ${registros} registros en ${datos.deals.length} deals:`,
    "",
  ];
  mostrados.forEach((deal, indice) => {
    lineas.push(`${indice + 1}) ${deal.nombreLead} · ${deal.programa} · ${deal.etapa}`);
    for (const pendiente of deal.pendientes) lineas.push(`   • ${vineta(pendiente, datos.dia)}`);
  });
  if (datos.deals.length > mostrados.length) {
    lineas.push(`(y ${datos.deals.length - mostrados.length} deals más en el CRM)`);
  }
  if (datos.citasAntiguas > 0) {
    lineas.push("", `Además: ${datos.citasAntiguas} citas de hace más de 7 días siguen sin resultado.`);
  }
  lineas.push(`Márcalas aquí: ${datos.enlace}`);
  return lineas.join("\n");
}
