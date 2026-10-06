import { db as dbDeLaApp } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveHistorica } from "@/lib/closers/identidad";
import { eq } from "drizzle-orm";
import { type SeleccionDeRango } from "@/lib/rangos";
import { parsearPeriodoUrl, resolverPeriodo, type EntradaDePeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { ventanasAnterioresDeCohorte } from "@/lib/queries/ventanas-de-cohortes";
import {
  cajaRecaudada,
  carteraDelPrograma,
  closersConCuenta,
  contratadoDelRango,
  contarCortesias,
  embudoDelRango,
  embudoPorCloser,
  leadsDelRango,
  sinResultadoDelRango,
  ventasDelRangoConValor,
  ventasPorCohorte,
  vistaDeCohorteActiva,
  type CajaPorMoneda,
  type EmbudoDelRango,
  type LeadsDelRango,
  type OpcionDeCloser,
  type VistaDeCohorte,
} from "@/lib/queries/dashboard";
import { comisionDeDeal, comisionesPorCloser } from "@/lib/queries/comision";
import { showsSinGrain } from "@/lib/queries/sin-grain";
import { banderasDelPulso, type BanderasDelPulso } from "@/lib/queries/banderas-del-pulso";
import { descuentoDeDeal } from "@/lib/queries/saldo";
import { leerMetasDelMes, type MetasDelMes } from "@/lib/queries/metas";
import { embudoPorEtapas, type ResultadoEmbudoEtapas } from "@/lib/queries/embudo-etapas";

/**
 * Arma de una sola vez todo lo que pinta `/p/[programa]/dashboard` (tickets 005 y 097).
 *
 * Existe para que la pagina no tenga que saber en que orden se preguntan las cosas ni
 * que consulta lleva closer y cual no. Dos reglas viven aca y en ningun otro lado:
 *
 *  - **El closer elegido acota todo menos el comparativo.** El comparativo entre
 *    closers es un comparativo completo (ADR 0023), asi que nunca se
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
  /** La clave de identidad del closer (ticket 167): un `users.id` uuid, o `null`. */
  claveCloser?: string | null;
  ahora?: Date;
}

export interface VistaDelDashboard {
  seleccion: SeleccionDeRango;
  periodo: PeriodoResuelto;
  anteriorDisponible: boolean;
  /** El closer al que se acoto la vista (su `users.id`), o null si se mira todo. */
  claveCloser: string | null;
  /** Los closers CON CUENTA que puede elegir el selector (valor = `users.id`). */
  closers: OpcionDeCloser[];
  embudo: EmbudoDelRango;
  anterior: { embudo: EmbudoDelRango; caja: CajaPorMoneda[]; contratadoUsd: number } | null;
  contratadoUsd: number;
  sinValorVendido: number;
  sinGrain: Awaited<ReturnType<typeof showsSinGrain>>;
  caja: CajaPorMoneda[];
  comision: { totalUsd: number; ventasSinComision: number };
  descuento: { promedioPct: number | null; promedioUsd: number | null; ventas: number };
  ventasPorCohorte: { cohorteId: string | null; codigo: string | null; ventas: number; contratadoUsd: number }[];
  cartera: {
    deals: number;
    saldoUsd: number;
    vencidos: number;
    sinFechaDeReferencia: number;
    sinSaldoCalculable: number;
  };
  sinResultado: number;
  /** Atendidos sin valor y sin Grain (ticket 191): foto de hoy, acotada por el dueño del deal. */
  banderas: BanderasDelPulso;
  cortesias: number;
  leads: LeadsDelRango;
  cohorte: VistaDeCohorte | null;
  metasDelMes: MetasDelMes;
  embudoEtapas: ResultadoEmbudoEtapas;
  /**
   * El comparativo entre closers, con la comision de sus ventas del rango (ticket 133).
   */
  comparativo: (Awaited<ReturnType<typeof embudoPorCloser>>[number] & {
    comisionUsd: number;
    ventasSinComision: number;
  })[];
  /** El porcentaje vigente; las ventas conservan el que se les congelo. */
  comisionPorcentaje: string | null;
}

export async function armarVistaDelDashboard(
  entrada: EntradaDeVista,
  db: Db = dbDeLaApp,
): Promise<VistaDelDashboard> {
  const { programId, hoy, preset, desde, hasta } = entrada;
  const claveCloser = entrada.claveCloser ?? null;

  const cohorte = await vistaDeCohorteActiva({ programId, claveCloser }, hoy, db);
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

  const alcance = { programId, rango, claveCloser };
  const ahora = entrada.ahora ?? new Date();

  const [
    embudo,
    sinGrain,
    caja,
    contratado,
    ventasConValor,
    porCohorte,
    cartera,
    sinResultado,
    banderas,
    cortesias,
    leads,
    metasDelMes,
    embudoEtapas,
    porCloser,
    comisiones,
    closers,
    [programa],
    anterior,
  ] = await Promise.all([
    embudoDelRango(alcance, db, ahora),
    showsSinGrain(alcance, db),
    cajaRecaudada(alcance, db),
    contratadoDelRango(alcance, db),
    ventasDelRangoConValor(alcance, db),
    ventasPorCohorte(alcance, db),
    carteraDelPrograma(programId, hoy, db),
    sinResultadoDelRango(alcance, ahora, db),
    banderasDelPulso({ programId, claveCloser }, db),
    contarCortesias(alcance, db),
    leadsDelRango(alcance, db),
    leerMetasDelMes(programId, hoy.slice(0, 7), hoy, db),
    embudoPorEtapas(db, { programId, rango }, ahora),
    embudoPorCloser({ programId, rango }, db, ahora),
    comisionesPorCloser({ programId, rango }, db),
    closersConCuenta({ programId, rango }, db),
    db.select({ comisionPorcentaje: programs.comisionPorcentaje }).from(programs).where(eq(programs.id, programId)),
    periodo.b
      ? Promise.all([
          embudoDelRango({ programId, rango: periodo.b, claveCloser }, db, ahora),
          cajaRecaudada({ programId, rango: periodo.b, claveCloser }, db),
          contratadoDelRango({ programId, rango: periodo.b, claveCloser }, db),
        ]).then(([embudoAnterior, cajaAnterior, contratadoAnterior]) => ({
          embudo: embudoAnterior,
          caja: cajaAnterior,
          contratadoUsd: contratadoAnterior.usd,
        }))
      : Promise.resolve(null),
  ]);
  const comisionPorClave = new Map(comisiones.map((c) => [c.userId ?? claveHistorica(c.closerId ?? ""), c]));
  const comparativo = porCloser.map((c) => ({
    ...c,
    comisionUsd: comisionPorClave.get(c.clave)?.comisionUsd ?? 0,
    ventasSinComision: comisionPorClave.get(c.clave)?.ventasSinComision ?? 0,
  }));
  let totalComision = 0;
  let ventasSinComision = 0;
  const descuentos = ventasConValor.flatMap((venta) => {
    const comision = comisionDeDeal(venta.valorVendidoUsd, venta.comisionPorcentaje);
    if (comision === null) ventasSinComision += 1;
    else totalComision += comision;
    const descuento = descuentoDeDeal(venta.ticketUsd, venta.valorVendidoUsd);
    return descuento ? [descuento] : [];
  });
  const promedio = (valores: number[]) => valores.length === 0
    ? null
    : valores.reduce((total, valor) => total + valor, 0) / valores.length;

  return {
    seleccion,
    periodo,
    anteriorDisponible: ventanas.anterior !== null,
    claveCloser,
    closers,
    embudo,
    anterior,
    contratadoUsd: contratado.usd,
    sinValorVendido: contratado.sinValorVendido,
    sinGrain,
    caja,
    comision: {
      totalUsd: Math.round(totalComision * 100) / 100,
      ventasSinComision,
    },
    descuento: {
      promedioPct: promedio(descuentos.map((descuento) => descuento.porcentaje)),
      promedioUsd: promedio(descuentos.map((descuento) => descuento.usd)),
      ventas: descuentos.length,
    },
    ventasPorCohorte: porCohorte,
    cartera,
    sinResultado,
    banderas,
    cortesias,
    leads,
    cohorte,
    metasDelMes,
    embudoEtapas,
    comparativo,
    comisionPorcentaje: programa?.comisionPorcentaje ?? null,
  };
}
