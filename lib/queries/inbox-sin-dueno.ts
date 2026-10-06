import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { calls, deals, leads, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { vigente } from "@/lib/queries/vigente";
import { ETAPAS_DE_SETTEO } from "@/lib/deals/etapas";

/**
 * Las dos listas por las que un deal SIN dueño consigue uno (ticket 070, ADR 0050): las
 * secciones "sin dueño" del Inbox de un programa.
 *
 * - **Por settear**: deals en una etapa de `ETAPAS_DE_SETTEO` sin dueño, que un closer
 *   reclama. **Ordenados por SCORE** (el que calculo el formulario, decision del 29-sep):
 *   de mayor a menor; a igual score, el envio mas reciente primero. **Sin score** (lo
 *   trasladado de Sheets y todo lo que llegue antes de configurar la variable en el
 *   formulario) va DESPUES, por recencia, marcado "sin score": no se le inventa uno.
 * - **Unclaimed (Agendados sin dueño)**: deals en etapa `agendado` sin dueño. Es el caso
 *   urgente —ya hay una cita y nadie la mira—, asi que se ordena por ANTIGUEDAD: lo mas
 *   viejo primero (lo que mas duele).
 *
 * ## El ORIGEN va a la vista (ampliacion del 21-sep, ADR 0044 punto 5)
 * Un lead traido por un closer NO se auto-asigna: el closer decide, y para decidir tiene
 * que ver el UTM. Por eso cada fila trae los UTM **tal como llegaron** (ADR 0004, sin
 * normalizar) y **quien lo trajo** cuando exista. La etiqueta de area (via el emparejador,
 * ticket 085) se enciende sola cuando exista; hoy no se muestra (enmienda del 28-sep).
 *
 * ## Reglas duras respetadas
 * - **El programa es frontera** (ADR 0043): recibe `programId` y filtra por el. Un deal de
 *   otro programa no puede aparecer aca.
 * - **Solo lo vigente** (`vigente(deals)`, ADR 0026): un deal anulado no cuenta.
 * - **Sin dueño**: `ownerUserId is null`. Un deal con dueño ya no esta "sin dueño".
 * - **Nada de subconsultas correlacionadas** en plantillas `sql` (AGENTS.md) ni un `Date`
 *   interpolado: cada seccion es UNA consulta con joins normales (leads, submission de
 *   origen) y el orden se resuelve con `asc`/`desc`. A esta escala (los sin dueño de un
 *   programa) es directo y se lee correcto.
 */

/** El origen del deal (su envio de origen, ADR 0060), a la vista para decidir si se reclama (ADR 0044). */
export interface OrigenDeFila {
  /** UTM tal como llego, sin normalizar (ADR 0004). `null` = sin UTM, un hecho valido. */
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  /**
   * Quien trajo al lead (`leads.traido_por_user_id` -> nombre del usuario, o su correo),
   * cuando este poblado (ticket 086). Traerlo no lo hace dueño (ADR 0044 punto 4): por
   * eso se muestra aqui, donde se reclama. Nulo = nadie lo trajo.
   */
  traidoPorNombre: string | null;
}

export interface FilaSinDueno {
  dealId: string;
  leadId: string;
  leadNombre: string | null;
  leadEmail: string;
  /** El score del formulario, o `null` (se muestra "sin score"). Nunca se inventa. */
  puntaje: number | null;
  /** La fecha del ultimo envio del lead, para ordenar por recencia. */
  fechaUltimaAplicacion: Date | null;
  origen: OrigenDeFila;
  /**
   * La llamada agendada SIN closer que el sistema dejo sin fecha, si existe (ticket 057).
   * `null` si el deal no tiene una. Al reclamar un Agendado, la pantalla ofrece
   * completarla; `completarAgendada` exige que el actor ya sea el dueño, asi que se
   * completa DESPUES de reclamar. Solo se llena en `unclaimed` (los de Por settear no
   * tienen cita).
   */
  llamadaPorCompletarId: string | null;
}

export interface SeccionesSinDueno {
  /** Por settear: por score desc (null al final), luego envio mas reciente. */
  pendienteSetteo: FilaSinDueno[];
  /** Agendados sin dueño: por antiguedad, lo mas viejo primero. */
  unclaimed: FilaSinDueno[];
}

/** Las columnas del lead que la fila necesita, para no repetir el select. */
const COLUMNAS_LEAD = {
  dealId: deals.id,
  leadId: leads.id,
  leadNombre: leads.nombre,
  leadEmail: leads.emailNormalizado,
  puntaje: leads.puntaje,
  fechaUltimaAplicacion: leads.fechaUltimaAplicacion,
  // El origen es del envio que abrio el deal (ADR 0060), nunca un resumen del lead.
  utmSource: submissions.utmSource,
  utmMedium: submissions.utmMedium,
  utmCampaign: submissions.utmCampaign,
  // Quien trajo al lead (ticket 086): su nombre, o su correo si no tiene nombre.
  traidoPorNombre: users.nombre,
  traidoPorEmail: users.email,
} as const;

type FilaCruda = {
  dealId: string;
  leadId: string;
  leadNombre: string | null;
  leadEmail: string;
  puntaje: number | null;
  fechaUltimaAplicacion: Date | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  traidoPorNombre: string | null;
  traidoPorEmail: string | null;
};

function aFila(f: FilaCruda, llamadaPorCompletarId: string | null = null): FilaSinDueno {
  return {
    dealId: f.dealId,
    leadId: f.leadId,
    leadNombre: f.leadNombre,
    leadEmail: f.leadEmail,
    puntaje: f.puntaje,
    fechaUltimaAplicacion: f.fechaUltimaAplicacion,
    origen: {
      utmSource: f.utmSource,
      utmMedium: f.utmMedium,
      utmCampaign: f.utmCampaign,
      traidoPorNombre: f.traidoPorNombre ?? f.traidoPorEmail,
    },
    llamadaPorCompletarId,
  };
}

export async function seccionesSinDueno(db: Db, programId: string): Promise<SeccionesSinDueno> {
  // Por settear: sin dueño, vigente, del programa. El orden por score va en memoria
  // (score desc con null al final, luego recencia desc): un `ORDER BY ... NULLS LAST`
  // mezclado con la recencia se lee peor y aqui el conjunto es chico. La consulta trae un
  // orden estable de respaldo (recencia) y el sort final decide.
  const setteo = await db
    .select(COLUMNAS_LEAD)
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .leftJoin(users, eq(users.id, leads.traidoPorUserId))
    .where(
      and(
        eq(deals.programId, programId),
        inArray(deals.etapa, [...ETAPAS_DE_SETTEO]),
        isNull(deals.ownerUserId),
        vigente(deals),
      ),
    );

  const pendienteSetteo = setteo.map((f) => aFila(f)).sort(ordenarSetteo);

  // Unclaimed: Agendados sin dueño, vigente, del programa, por antiguedad del deal (el mas
  // viejo primero: `created_at` asc). No hay `Date` interpolado en `sql`: el orden es por
  // columna con `asc`.
  const agendados = await db
    .select(COLUMNAS_LEAD)
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
    .leftJoin(users, eq(users.id, leads.traidoPorUserId))
    .where(
      and(
        eq(deals.programId, programId),
        eq(deals.etapa, "agendado"),
        isNull(deals.ownerUserId),
        vigente(deals),
      ),
    )
    .orderBy(asc(deals.createdAt));

  // La llamada agendada sin closer de cada uno de esos deals, en UNA consulta aparte que se
  // une en memoria (nada de subconsulta correlacionada, AGENTS.md). A esta escala (los
  // Agendados sin dueño de un programa) es directo. Si hubiera mas de una agendada sin
  // closer por deal —no deberia—, gana la mas reciente por `createdAt`.
  const dealIds = agendados.map((f) => f.dealId);
  const porCompletar = new Map<string, string>();
  if (dealIds.length > 0) {
    const llamadas = await db
      .select({ id: calls.id, dealId: calls.dealId, createdAt: calls.createdAt })
      .from(calls)
      .where(
        and(
          inArray(calls.dealId, dealIds),
          eq(calls.resultado, "agendada"),
          isNull(calls.closerUserId),
          vigente(calls),
        ),
      )
      .orderBy(desc(calls.createdAt));
    for (const l of llamadas) {
      if (l.dealId != null && !porCompletar.has(l.dealId)) porCompletar.set(l.dealId, l.id);
    }
  }

  const unclaimed = agendados.map((f) => aFila(f, porCompletar.get(f.dealId) ?? null));

  return { pendienteSetteo, unclaimed };
}

/**
 * El orden del Setteo (decision del 29-sep): score de mayor a menor; **sin score va
 * DESPUES** (no se le inventa un cero, que lo pondria en el medio); a igual score o entre
 * los sin score, el envio mas reciente primero.
 */
function ordenarSetteo(a: FilaSinDueno, b: FilaSinDueno): number {
  const sa = a.puntaje;
  const sb = b.puntaje;
  if (sa !== sb) {
    if (sa === null) return 1; // a sin score va despues
    if (sb === null) return -1; // b sin score va despues
    return sb - sa; // mayor score primero
  }
  // Mismo score (o ambos sin score): el envio mas reciente primero. Una fecha nula va al
  // final dentro de su grupo (un lead sin fecha no le gana a uno con fecha).
  return recienteDesc(a.fechaUltimaAplicacion, b.fechaUltimaAplicacion);
}

function recienteDesc(a: Date | null, b: Date | null): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return b.getTime() - a.getTime();
}
