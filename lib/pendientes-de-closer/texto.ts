import type { VentanaPendientes } from "./contrato";

export type TipoPendienteCloser = "sin_resultado" | "sin_comprobante" | "sin_grain" | "reagenda" | "vencidos" | "nuevos";

/** Prioridad compartida de los recordatorios de las 8 a. m. (ticket 428). */
export const ORDEN_PENDIENTES = ["sin_resultado", "sin_comprobante", "sin_grain", "vencidos", "reagenda", "nuevos"] as const satisfies readonly TipoPendienteCloser[];

export interface PendienteDeDeal {
  tipo: TipoPendienteCloser;
  fecha: Date | string | null;
  detalle?: "seguimiento" | "compromiso" | "cartera";
}

export interface DealConPendientes {
  dealId: string;
  nombreLead: string;
  programa: string;
  programSlug: string;
  url: string;
  fechaUrgencia: Date;
  pendientes: PendienteDeDeal[];
}

export interface DatosTextoPendientes {
  nombreCloser: string;
  ventana: VentanaPendientes;
  deals: DealConPendientes[];
  citasAntiguas: number;
  enlaces: { programa: string; url: string }[];
}

const DIA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", weekday: "short", day: "2-digit", month: "short" });
const HORA = new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "2-digit", minute: "2-digit", hour12: false });

function fechaComoDate(fecha: Date | string | null): Date | null {
  if (fecha === null) return null;
  return fecha instanceof Date ? fecha : new Date(`${fecha}T12:00:00-05:00`);
}

function fechaCorta(fecha: Date | string | null): string {
  const valor = fechaComoDate(fecha);
  if (!valor) return "fecha pendiente";
  return DIA.format(valor).replaceAll(".", "").replace(" de ", "-");
}

export interface RapidoPendiente {
  deal: DealConPendientes;
  pendiente: PendienteDeDeal;
}

function valorDeFecha(fecha: Date | string | null): number {
  return fechaComoDate(fecha)?.getTime() ?? Number.NEGATIVE_INFINITY;
}

/** Un deal por acción, repartidos por tipo y de lo más reciente a lo más antiguo (ticket 428). */
export function elegirRapidos(deals: DealConPendientes[], max = 5): RapidoPendiente[] {
  const colas = new Map<TipoPendienteCloser, RapidoPendiente[]>();
  for (const tipo of ORDEN_PENDIENTES) {
    const candidatos = deals.flatMap((deal) => deal.pendientes
      .filter((pendiente) => pendiente.tipo === tipo)
      .map((pendiente) => ({ deal, pendiente })))
      .sort((a, b) => valorDeFecha(b.pendiente.fecha) - valorDeFecha(a.pendiente.fecha) || a.deal.dealId.localeCompare(b.deal.dealId));
    colas.set(tipo, candidatos);
  }
  const elegidos: RapidoPendiente[] = [];
  const dealsElegidos = new Set<string>();
  while (elegidos.length < max) {
    let agrego = false;
    for (const tipo of ORDEN_PENDIENTES) {
      const cola = colas.get(tipo)!;
      let candidato = cola.shift();
      while (candidato && dealsElegidos.has(candidato.deal.dealId)) candidato = cola.shift();
      if (!candidato) continue;
      elegidos.push(candidato);
      dealsElegidos.add(candidato.deal.dealId);
      agrego = true;
      if (elegidos.length === max) break;
    }
    if (!agrego) break;
  }
  return elegidos;
}

function accion(pendiente: PendienteDeDeal): string {
  const fecha = fechaCorta(pendiente.fecha);
  switch (pendiente.tipo) {
    case "sin_resultado":
      return `marca cómo terminó la cita del ${fecha}`;
    case "sin_comprobante":
      return `sube el comprobante del abono del ${fecha}`;
    case "sin_grain":
      return `pega el link de Grain de la llamada del ${fecha}`;
    case "reagenda":
      return "vuelve a agendar la llamada";
    case "vencidos": {
      if (pendiente.detalle === "compromiso") return `confirma el pago comprometido (venció el ${fecha})`;
      if (pendiente.detalle === "cartera") return pendiente.fecha
        ? `cobra el saldo (venció el ${fecha})`
        : "cobra el saldo y ponle fecha límite";
      return `haz el seguimiento (venció el ${fecha})`;
    }
    case "nuevos":
      return "ábrelo y haz el primer contacto";
  }
}

const NOMBRE_PENDIENTE: Readonly<Record<TipoPendienteCloser, string>> = {
  sin_resultado: "citas sin resultado",
  sin_comprobante: "abonos sin comprobante",
  sin_grain: "llamadas sin Grain",
  vencidos: "cobros y seguimientos vencidos",
  reagenda: "re-agendas pendientes",
  nuevos: "deals asignados sin abrir",
};

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
  for (const enlace of datos.enlaces) {
    lineas.push(datos.enlaces.length === 1
      ? `Márcalas aquí: ${enlace.url}`
      : `Márcalas en ${enlace.programa}: ${enlace.url}`);
  }
  return lineas.join("\n");
}

/** Texto plano que Juanito manda tal cual, sin completar nombres ni datos de contacto. */
export function textoDePendientesDeCloser(datos: DatosTextoPendientes): string {
  if (datos.ventana === "tarde") return textoDeLaTarde(datos);
  const rapidos = elegirRapidos(datos.deals);
  const lineas: string[] = [];
  if (rapidos.length > 0) {
    lineas.push(`${nombreDePila(datos.nombreCloser)}, hoy ${rapidos.length} acciones rápidas:`, "");
    rapidos.forEach(({ deal, pendiente }, indice) => {
      lineas.push(`${indice + 1}) ${deal.nombreLead} (${deal.programa}): ${accion(pendiente)}`, `   ${deal.url}`);
    });
    lineas.push("");
  }
  lineas.push("Todo lo que tienes pendiente:");
  const conteos = Object.fromEntries(ORDEN_PENDIENTES.map((tipo) => [tipo, 0])) as Record<TipoPendienteCloser, number>;
  for (const deal of datos.deals) for (const pendiente of deal.pendientes) conteos[pendiente.tipo] += 1;
  conteos.sin_resultado += datos.citasAntiguas;
  for (const tipo of ORDEN_PENDIENTES) {
    if (conteos[tipo] === 0) continue;
    const antiguas = tipo === "sin_resultado" && datos.citasAntiguas > 0 ? ` (${datos.citasAntiguas} de hace más de 7 días)` : "";
    lineas.push(`• ${conteos[tipo]} ${NOMBRE_PENDIENTE[tipo]}${antiguas}`);
  }
  lineas.push("");
  for (const enlace of datos.enlaces) {
    lineas.push(datos.enlaces.length === 1
      ? `Verlos todos: ${enlace.url}`
      : `Verlos todos en ${enlace.programa}: ${enlace.url}`);
  }
  return lineas.join("\n");
}
