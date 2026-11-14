/**
 * "¿Cómo va el costo por agenda hoy?" como cuatro Cifras (ticket 419 paso 3, `docs/diseno-cifra-y-pauta.md` §4.2).
 *
 * Recibe lo que ya calculó `semaforoDelPrograma` y lo vuelve `CifraDeMetrica`. No recalcula nada: el costo es el del
 * semáforo (gasto en campañas de agenda ÷ agendas según Meta) y el estado es su color, así la pantalla y el reporte de
 * WhatsApp nunca discrepan (DM-1: cambia el rótulo, no el cálculo). Módulo PURO.
 */
import { armarCifra, type CifraDeMetrica, type FuenteDeEstado } from "@/lib/metricas/cifra";
import { explicacionDe, VARIANTES_DE_PAUTA } from "@/lib/metricas/explicacion";
import { cop, fechaCorta } from "@/lib/format";
import type { MetricaSemaforo } from "@/lib/semaforo/semaforo";

/**
 * Por qué el costo sale "—", en palabras de negocio. Sale de los datos y no del motivo del color: un programa sin
 * umbral tiene costo igual, y lo que deja el costo sin calcular siempre son las agendas o el gasto.
 */
export function motivoSinCosto(m: Pick<MetricaSemaforo, "gasto" | "agendasMeta" | "agendasCrm">, enCurso: boolean): string {
  if (m.agendasMeta === null) return "Meta no reporta agendas de este programa";
  if (m.gasto === 0) return "No hubo gasto en campañas de agenda";
  if (enCurso && m.agendasCrm > 0) return "Meta aún no cuenta las agendas del CRM: las cuenta con retraso";
  return "Se gastó en campañas de agenda y Meta no reporta ninguna agenda";
}

export interface EntradaDeCifrasDelSemaforo {
  metrica: MetricaSemaforo;
  /** "cierre" después de las 6 p. m.: el día de ayer completo. */
  tipo: "dia" | "cierre";
  /** Hora de corte en Bogotá, "15:00". */
  hora: string;
  /** Solo si se pidió comparar en la página. */
  comparar: boolean;
  programa?: string;
}

export interface CifrasDelSemaforo {
  costo: CifraDeMetrica;
  agendas: CifraDeMetrica;
  agendasMeta: CifraDeMetrica;
  inversion: CifraDeMetrica;
  /** El subtítulo del bloque: de cuándo es. */
  subtitulo: string;
}

export function subtituloDelSemaforo(tipo: "dia" | "cierre", hora: string, dia: string): string {
  return tipo === "cierre"
    ? `Ayer completo (${fechaCorta(dia)}). Siempre es del último día, sin importar el periodo elegido.`
    : `Hoy hasta las ${hora.replace(/\.$/, "")}. Siempre es de hoy, sin importar el periodo elegido.`;
}

function estadoDelSemaforo(m: MetricaSemaforo): FuenteDeEstado | undefined {
  if (m.color === "sin_dato" || !m.umbral) return undefined;
  return {
    fuente: "objetivo",
    objetivo: m.umbral.meta,
    aceptable: m.umbral.aceptable ?? m.umbral.meta,
    menorEsMejor: true,
    tono: m.color,
  };
}

export function cifrasDelSemaforo(e: EntradaDeCifrasDelSemaforo): CifrasDelSemaforo {
  const m = e.metrica;
  const enCurso = e.tipo === "dia";
  const periodo = e.tipo === "cierre" ? `el ${fechaCorta(m.dia)} completo` : `hoy (hasta las ${e.hora})`;
  const filtros: Array<readonly [string, string]> = [];
  if (e.programa) filtros.push(["Programa", e.programa]);
  filtros.push(["Área", "Paid"]);
  filtros.push(["Día", e.tipo === "cierre" ? `${fechaCorta(m.dia)} completo` : `Hoy hasta las ${e.hora}`]);
  const ref = m.comparacion && e.comparar ? m.comparacion : null;
  const referencia = ref ? `${ref.etiqueta} (${fechaCorta(ref.dia)})` : "";
  const etiqueta = ref?.etiqueta === "día anterior" ? "Contra el día anterior" : "Contra ayer a esta hora";
  const comparacion = (valor: number | null) => ref ? { referencia, valor, etiqueta } : undefined;
  const otras = m.gastoTotal - m.gasto;

  const costo = armarCifra({
    concepto: "costo_agenda_meta",
    explicacion: explicacionDe("costo_agenda_meta"),
    valor: m.costo,
    motivo: m.costo === null ? motivoSinCosto(m, enCurso) : undefined,
    partes: [m.gasto, m.agendasMeta],
    periodo,
    filtros,
    enCurso,
    comparacion: comparacion(ref?.costo ?? null),
    estado: estadoDelSemaforo(m),
    linea: otras > 0 ? { antes: "Sin contar ", cifra: cop(otras), despues: " de otras campañas" } : undefined,
    notas: otras > 0
      ? [["Otras campañas", `Lanzamientos y tráfico a Instagram gastaron ${cop(otras)} en el mismo día. No entran en el costo por agenda; sí en la inversión.`]]
      : undefined,
  });
  const agendas = armarCifra({
    concepto: "agendadas",
    explicacion: explicacionDe("agendadas"),
    valor: m.agendasCrm,
    periodo,
    filtros,
    enCurso,
    comparacion: comparacion(ref?.agendasCrm ?? null),
  });
  const agendasMeta = armarCifra({
    concepto: "agendas_meta",
    explicacion: explicacionDe("costo_agenda_meta", VARIANTES_DE_PAUTA.agendas_meta),
    valor: m.agendasMeta,
    motivo: m.agendasMeta === null ? "Meta no reporta agendas de este programa" : undefined,
    periodo,
    filtros,
    enCurso,
    comparacion: comparacion(ref?.agendasMeta ?? null),
  });
  const inversion = armarCifra({
    concepto: "inversion",
    explicacion: explicacionDe("inversion"),
    valor: m.gastoTotal,
    periodo,
    filtros,
    enCurso,
  });
  return { costo, agendas, agendasMeta, inversion, subtitulo: subtituloDelSemaforo(e.tipo, e.hora, m.dia) };
}
