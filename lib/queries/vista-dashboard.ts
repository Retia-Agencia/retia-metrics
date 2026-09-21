import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import { resolverRango, type SeleccionDeRango } from "@/lib/rangos";
import {
  cajaRecaudada,
  embudoDelRango,
  embudoPorCloser,
  embudoPorOrigen,
  leadsDelRango,
  llamadasPorMotivo,
  vistaDeCohorteActiva,
  type CajaPorMoneda,
  type EmbudoDelRango,
  type LeadsDelRango,
  type VistaDeCohorte,
} from "@/lib/queries/dashboard";

/**
 * Arma de una sola vez todo lo que pinta `/programas/[slug]` (ticket 005).
 *
 * Existe para que la pagina no tenga que saber en que orden se preguntan las cosas ni
 * que consulta lleva closer y cual no. Dos reglas viven aca y en ningun otro lado:
 *
 *  - **El closer elegido acota todo menos el comparativo.** El comparativo entre
 *    closers es justo lo que "todos ven todo" garantiza (ADR 0009), asi que nunca se
 *    filtra; su tipo ni siquiera lo admite.
 *  - **La cohorte se pregunta ANTES de resolver el rango**, porque el preset
 *    "cohorte" sale de la ventana de venta de la cohorte activa (ADR 0022) y esa
 *    ventana se mide contra hoy, no contra el rango elegido.
 *
 * No recibe rol ni sesion a proposito: no hay forma de que un gerente y un closer
 * vean numeros distintos.
 */

export interface EntradaDeVista {
  programId: string;
  /** Hoy en Bogota, 'YYYY-MM-DD'. */
  hoy: string;
  /** Lo que venga en la URL; si no sirve, `resolverRango` cae a hoy. */
  preset: string;
  desde?: string;
  hasta?: string;
  closerId?: string | null;
}

export interface VistaDelDashboard {
  seleccion: SeleccionDeRango;
  /** El closer al que se acoto la vista, o null si se esta mirando todo el programa. */
  closerId: string | null;
  /** Los closers que puede elegir el selector. */
  closers: string[];
  embudo: EmbudoDelRango;
  caja: CajaPorMoneda[];
  leads: LeadsDelRango;
  cohorte: VistaDeCohorte | null;
  motivos: { motivo: string; llamadas: number }[];
  origenes: Awaited<ReturnType<typeof embudoPorOrigen>>;
  comparativo: Awaited<ReturnType<typeof embudoPorCloser>>;
}

export async function armarVistaDelDashboard(
  entrada: EntradaDeVista,
  db: Db = dbDeLaApp,
): Promise<VistaDelDashboard> {
  const { programId, hoy, preset, desde, hasta } = entrada;
  const closerId = entrada.closerId ?? null;

  const cohorte = await vistaDeCohorteActiva({ programId, closerId }, hoy, db);
  const seleccion = resolverRango({ preset, hoy, ventana: cohorte?.ventana ?? null, desde, hasta });
  const rango = seleccion.rango;

  const alcance = { programId, rango, closerId };

  const [embudo, caja, leads, motivos, origenes, comparativo] = await Promise.all([
    embudoDelRango(alcance, db),
    cajaRecaudada(alcance, db),
    leadsDelRango(alcance, db),
    llamadasPorMotivo(alcance, db),
    embudoPorOrigen(alcance, db),
    embudoPorCloser({ programId, rango }, db),
  ]);

  // Las opciones del selector salen del comparativo (quien tiene actividad en el
  // rango), mas el closer ya elegido: si no, cambiar de rango a uno donde no hizo
  // nada le borraria la seleccion al usuario mientras la pantalla sigue mostrando
  // los numeros de ese closer.
  const closers = [...new Set(comparativo.map((c) => c.closerId).concat(closerId))]
    .filter((c): c is string => c !== null)
    .sort((a, b) => a.localeCompare(b));

  return {
    seleccion,
    closerId,
    closers,
    embudo,
    caja,
    leads,
    cohorte,
    motivos,
    origenes,
    comparativo,
  };
}
