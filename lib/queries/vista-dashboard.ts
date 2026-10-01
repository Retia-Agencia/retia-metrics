import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import { type SeleccionDeRango } from "@/lib/rangos";
import { parsearPeriodoUrl, resolverPeriodo, type EntradaDePeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { ventanasAnterioresDeCohorte } from "@/lib/queries/ventanas-de-cohortes";
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
import { comisionPorVentaDe, comisionUsd } from "@/lib/queries/comision";

/**
 * Arma de una sola vez todo lo que pinta `/p/[programa]/dashboard` (tickets 005 y 097).
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
  periodo?: EntradaDePeriodo;
  desde?: string;
  hasta?: string;
  closerId?: string | null;
}

export interface VistaDelDashboard {
  seleccion: SeleccionDeRango;
  periodo: PeriodoResuelto;
  anteriorDisponible: boolean;
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
  /**
   * El comparativo entre closers, con la comision de cada uno (ticket 062): sus cierres del
   * rango por el monto por venta del programa. `comisionUsd` es `null` si el programa no
   * tiene el monto cargado.
   */
  comparativo: (Awaited<ReturnType<typeof embudoPorCloser>>[number] & { comisionUsd: number | null })[];
  /** El monto por venta vigente del programa, en USD, o `null` si no esta cargado. */
  comisionPorVentaUsd: string | null;
}

export async function armarVistaDelDashboard(
  entrada: EntradaDeVista,
  db: Db = dbDeLaApp,
): Promise<VistaDelDashboard> {
  const { programId, hoy, preset, desde, hasta } = entrada;
  const closerId = entrada.closerId ?? null;

  const cohorte = await vistaDeCohorteActiva({ programId, closerId }, hoy, db);
  const ventanas = cohorte
    ? await ventanasAnterioresDeCohorte(db, programId, cohorte.cohorteId)
    : { anterior: null, anteAnterior: null };
  const periodo = resolverPeriodo(entrada.periodo ?? parsearPeriodoUrl({ rango: preset, desde, hasta }), {
    hoy, actual: cohorte?.ventana, ...ventanas,
  });
  // La proyección antigua se conserva para consumidores del dashboard.
  const equivalentes = { hoy: "hoy", esta_semana: "semana", este_mes: "mes", cohorte_actual: "cohorte" } as const;
  const seleccion: SeleccionDeRango = {
    preset: equivalentes[periodo.preset as keyof typeof equivalentes] ?? "custom",
    rango: periodo.a,
  };
  const rango = periodo.a;

  const alcance = { programId, rango, closerId };

  const [embudo, caja, leads, motivos, origenes, porCloser, comisionPorVentaUsd] = await Promise.all([
    embudoDelRango(alcance, db),
    cajaRecaudada(alcance, db),
    leadsDelRango(alcance, db),
    llamadasPorMotivo(alcance, db),
    embudoPorOrigen(alcance, db),
    embudoPorCloser({ programId, rango }, db),
    comisionPorVentaDe(programId, db),
  ]);
  // La comision sale de los MISMOS cierres de la fila: la columna y la cifra no pueden discrepar.
  const comparativo = porCloser.map((c) => ({ ...c, comisionUsd: comisionUsd(c.cierres, comisionPorVentaUsd) }));

  // Las opciones del selector salen del comparativo (quien tiene actividad en el
  // rango), mas el closer ya elegido: si no, cambiar de rango a uno donde no hizo
  // nada le borraria la seleccion al usuario mientras la pantalla sigue mostrando
  // los numeros de ese closer.
  const closers = [...new Set(comparativo.map((c) => c.closerId).concat(closerId))]
    .filter((c): c is string => c !== null)
    .sort((a, b) => a.localeCompare(b));

  return {
    seleccion,
    periodo,
    anteriorDisponible: ventanas.anterior !== null,
    closerId,
    closers,
    embudo,
    caja,
    leads,
    cohorte,
    motivos,
    origenes,
    comparativo,
    comisionPorVentaUsd,
  };
}
