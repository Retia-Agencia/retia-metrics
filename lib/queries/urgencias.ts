import { eq } from "drizzle-orm";
import type { CanalActivo } from "@/lib/atribucion/canal";
import { areas, canales } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esDiaHabil } from "@/lib/dias-habiles";
import { sumarDias } from "@/lib/rangos";
import { pautaInterina, type FilaPauta } from "@/lib/queries/pauta-interina";
import { agruparPorCanal, type OrigenPorCanal } from "@/lib/queries/registros-agendas-canal";

/**
 * La réplica de la pestaña `🚨 Urgencias` de la hoja (ticket 066): las agendas del día hábil
 * anterior, contra el promedio de los siete días hábiles previos, con su semáforo y el desglose
 * por canal con el % del día.
 *
 * NO define agenda ni registro: reagrupa la serie de `pautaInterina` (093), donde viven las dos
 * definiciones (`docs/analytics.md` §6), y el canal lo decide `agruparPorCanal` (088) con
 * `resolverCanal` y el catálogo de Canales (101). Así Urgencias, Pauta y "registros contra agendas"
 * no pueden dar cifras distintas para el mismo día.
 *
 * Los huérfanos son filas de primera clase y salen SIEMPRE, aunque estén en cero (corrección del
 * 24-sep, ADR 0045): **sin UTM** (llegó sin origen, problema de captación) y **sin clasificar**
 * (trae UTM y no casa con ningún canal, se arregla con una fila del catálogo). Además, **sin envío
 * de origen**: una agenda cuyo deal no nació de un envío; sin ella el % del día no sumaría 100.
 *
 * Por programa, siempre (ADR 0043): no hay versión "todos" porque el semáforo es una tasa.
 */

/** Cuántos días hábiles entran al promedio. Es el "promedio de 7 días" de la hoja. */
export const DIAS_DEL_PROMEDIO = 7;

/**
 * Umbral del semáforo, como fracción del promedio: el día que alcanza el promedio está "en ruta";
 * por debajo del promedio pero sobre este umbral, "atento"; por debajo, "atrasado". Sigue la forma
 * de DP-24 (meta y aceptable) con el promedio como meta. 🟡 El 75% es propuesta: la hoja no
 * documenta su corte y no hay tabla de objetivos (122) para estas agendas.
 */
export const UMBRAL_ACEPTABLE = 0.75;

export type Semaforo = "exito" | "alerta" | "peligro";

export interface FilaUrgencias {
  origen: OrigenPorCanal;
  canalId: string | null;
  canal: string | null;
  area: string | null;
  /** Agendas del día observado. */
  agendas: number;
  /** Registros (envíos completos) del día observado. */
  registros: number;
  /** Promedio de agendas por día hábil en la ventana previa. */
  promedioAgendas: number;
}

export interface VistaUrgencias {
  /** El día hábil observado ("ayer"), `YYYY-MM-DD` en Bogotá. */
  dia: string;
  /** Los días hábiles del promedio, del más viejo al más nuevo. Nunca incluye `dia`. */
  ventana: string[];
  agendas: number;
  registros: number;
  promedioAgendas: number;
  /** `null` cuando el promedio es cero: sin base no hay contra qué comparar. */
  semaforo: Semaforo | null;
  filas: FilaUrgencias[];
}

/** El día hábil anterior a `hoy` (los festivos cuentan como hábiles: solo se saltan fines de semana). */
export function diaHabilAnterior(hoy: string): string {
  let dia = sumarDias(hoy, -1);
  while (!esDiaHabil(dia)) dia = sumarDias(dia, -1);
  return dia;
}

/** Los `n` días hábiles anteriores a `dia`, sin incluirlo, del más viejo al más nuevo. */
export function habilesPrevios(dia: string, n: number): string[] {
  const dias: string[] = [];
  let cursor = dia;
  while (dias.length < n) {
    cursor = diaHabilAnterior(cursor);
    dias.unshift(cursor);
  }
  return dias;
}

/** El semáforo del día contra el promedio. Pura, para probarla en los dos sentidos. */
export function semaforoDelDia(agendas: number, promedio: number): Semaforo | null {
  if (promedio <= 0) return null;
  if (agendas >= promedio) return "exito";
  if (agendas >= promedio * UMBRAL_ACEPTABLE) return "alerta";
  return "peligro";
}

const ORDEN_HUERFANO: Record<OrigenPorCanal, number> = { canal: 0, sin_clasificar: 1, sin_utm: 2, sin_envio_origen: 3 };

/** La reagrupación, pura: la serie de Pauta y el catálogo entran como datos. */
export function armarUrgencias(
  serie: readonly FilaPauta[],
  catalogo: readonly CanalActivo[],
  nombreDeArea: ReadonlyMap<string, string>,
  dia: string,
): VistaUrgencias {
  const ventana = habilesPrevios(dia, DIAS_DEL_PROMEDIO);
  const enVentana = new Set(ventana);
  const delDia = agruparPorCanal(
    serie.filter((f) => f.dia === dia),
    catalogo,
    nombreDeArea,
  );
  const previos = agruparPorCanal(
    serie.filter((f) => enVentana.has(f.dia)),
    catalogo,
    nombreDeArea,
  );

  const filas = new Map<string, FilaUrgencias>();
  const clave = (f: { canalId: string | null; origen: OrigenPorCanal }) => f.canalId ?? f.origen;
  for (const f of delDia.filas) {
    filas.set(clave(f), {
      origen: f.origen,
      canalId: f.canalId,
      canal: f.canal,
      area: f.area,
      agendas: f.agendas,
      registros: f.registros,
      promedioAgendas: 0,
    });
  }
  for (const f of previos.filas) {
    const fila =
      filas.get(clave(f)) ??
      { origen: f.origen, canalId: f.canalId, canal: f.canal, area: f.area, agendas: 0, registros: 0, promedioAgendas: 0 };
    fila.promedioAgendas = f.agendas / DIAS_DEL_PROMEDIO;
    filas.set(clave(f), fila);
  }

  const promedioAgendas = previos.total.agendas / DIAS_DEL_PROMEDIO;
  return {
    dia,
    ventana,
    agendas: delDia.total.agendas,
    registros: delDia.total.registros,
    promedioAgendas,
    semaforo: semaforoDelDia(delDia.total.agendas, promedioAgendas),
    filas: [...filas.values()].sort(
      (a, b) =>
        ORDEN_HUERFANO[a.origen] - ORDEN_HUERFANO[b.origen] ||
        b.agendas - a.agendas ||
        b.promedioAgendas - a.promedioAgendas ||
        (a.canal ?? "").localeCompare(b.canal ?? "", "es"),
    ),
  };
}

/**
 * Urgencias de un programa vista desde `hoy` (el día de Bogotá que entrega el servidor con
 * `hoyEnBogota()`): observa el día hábil anterior.
 */
export async function urgenciasDelPrograma(db: Db, programId: string, hoy: string): Promise<VistaUrgencias> {
  const dia = diaHabilAnterior(hoy);
  const ventana = habilesPrevios(dia, DIAS_DEL_PROMEDIO);
  const [pauta, catalogo, listaAreas] = await Promise.all([
    pautaInterina(db, programId, { desde: ventana[0], hasta: dia }, {}, hoy),
    db.select().from(canales).where(eq(canales.activo, true)),
    db.select({ id: areas.id, nombre: areas.nombre }).from(areas),
  ]);
  return armarUrgencias(pauta.filas, catalogo, new Map(listaAreas.map((a) => [a.id, a.nombre])), dia);
}
