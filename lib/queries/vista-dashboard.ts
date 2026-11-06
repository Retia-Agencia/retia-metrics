import { db as dbDeLaApp } from "@/lib/db";
import { programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveHistorica } from "@/lib/closers/identidad";
import { eq } from "drizzle-orm";
import { type SeleccionDeRango } from "@/lib/rangos";
import { comparacionesDe, parsearPeriodoUrl, resolverPeriodo, type EntradaDePeriodo, type PeriodoResuelto } from "@/lib/periodo";
import { cohorteDelHub, contextoDelFiltro, type OpcionDeCohorte } from "@/lib/queries/cohorte-del-hub";
import {
  cajaRecaudada,
  closersConCuenta,
  contratadoDelRango,
  dineroDelRango,
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
import { dineroDeVentas, type DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
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
 *  - **La cohorte se pregunta ANTES de resolver el rango**, porque "Desde el inicio"
 *    arranca en lo primero que pasó en la cohorte elegida (377) y la comparación por
 *    cohorte sale de la ventana de venta de la anterior a ella (ADR 0022).
 *  - **El filtro de cohorte es de la consulta** (377, G-1): con `filtroDeCohorte` los
 *    hechos se acotan por `deals.cohort_id` en SQL; sin él (Hoy, Mi espacio) la cohorte
 *    solo decide las fechas y no filtra nada.
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
  /**
   * Presente = el Hub filtra por cohorte (377): `parametro` es el `?cohorte=` de la URL (`todas`, un id
   * o nada = la activa). Ausente = sin filtro de cohorte.
   */
  filtroDeCohorte?: { parametro?: string };
  ahora?: Date;
}

/** El filtro de cohorte tal como quedó resuelto: lo que la barra y la línea de texto necesitan. */
export interface FiltroDeCohorteResuelto {
  /** Lo que filtró las consultas: la cohorte elegida, o `null` con "Todas" o sin filtro. */
  cohorteId: string | null;
  /** La elegida (aunque no se aplique como filtro): sus fechas rigen "Desde el inicio". */
  elegida: { id: string; codigo: string; metaCupos: number; inicioVentas: string | null; cierreVentas: string | null } | null;
  opciones: OpcionDeCohorte[];
  /**
   * La cohorte con que se consulta B: la anterior cuando se compara contra "Cohorte anterior" (C3 contra C2
   * al mismo día hábil de su venta), la misma del filtro en cualquier otra comparación.
   */
  cohorteIdDeB: string | null;
  /** Las ventas reales de la elegida (o del programa con "Todas"), con su día. */
  ventas: { dealId: string; dia: string }[];
}

export interface VistaDelDashboard {
  seleccion: SeleccionDeRango;
  periodo: PeriodoResuelto;
  anteriorDisponible: boolean;
  filtroDeCohorte: FiltroDeCohorteResuelto;
  /** El closer al que se acoto la vista (su `users.id`), o null si se mira todo. */
  claveCloser: string | null;
  /** Los closers CON CUENTA que puede elegir el selector (valor = `users.id`). */
  closers: OpcionDeCloser[];
  embudo: EmbudoDelRango;
  anterior: { embudo: EmbudoDelRango; caja: CajaPorMoneda[]; contratadoUsd: number; dinero: DineroDeVentas } | null;
  contratadoUsd: number;
  /** Vendido, Recaudado y Por cobrar de las MISMAS ventas del periodo y los filtros (369). */
  dinero: DineroDeVentas;
  sinValorVendido: number;
  sinGrain: Awaited<ReturnType<typeof showsSinGrain>>;
  caja: CajaPorMoneda[];
  comision: { totalUsd: number; ventasSinComision: number };
  descuento: { promedioPct: number | null; promedioUsd: number | null; ventas: number };
  ventasPorCohorte: { cohorteId: string | null; codigo: string | null; ventas: number; contratadoUsd: number; dinero: DineroDeVentas }[];
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

/**
 * Lo barato de la vista: el periodo, el filtro de cohorte y la cohorte activa. Es lo que la cabecera
 * del Hub necesita para pintar (selector de periodo y de cohorte) sin esperar las ~40 consultas de
 * cifras. `armarVistaDelDashboard` lo reutiliza, así que hay UNA sola resolución (N1).
 */
export interface ContextoDeVista {
  seleccion: SeleccionDeRango;
  periodo: PeriodoResuelto;
  anteriorDisponible: boolean;
  filtroDeCohorte: FiltroDeCohorteResuelto;
  claveCloser: string | null;
  cohorte: VistaDeCohorte | null;
  cohorteIdDeB: string | null;
  /** Perezoso y memoizado: la consulta solo corre si alguien lo pide (el Hub la pide en la barra de filtros). */
  closers: () => Promise<OpcionDeCloser[]>;
}

export async function resolverContextoDeVista(entrada: EntradaDeVista, db: Db = dbDeLaApp): Promise<ContextoDeVista> {
  const { programId, hoy, preset, desde, hasta } = entrada;
  const claveCloser = entrada.claveCloser ?? null;
  const pedido = entrada.periodo ?? parsearPeriodoUrl({ rango: preset, desde, hasta });
  // La cohorte activa no depende del periodo: corre a la par de la cadena cohorte del Hub -> contexto.
  const [cohorte, { delHub, contexto }] = await Promise.all([
    vistaDeCohorteActiva({ programId, claveCloser }, hoy, db),
    (async () => {
      const delHub = await cohorteDelHub(db, programId, { parametro: entrada.filtroDeCohorte?.parametro, cohorteVieja: pedido.cohorteVieja });
      const contexto = await contextoDelFiltro(db, programId, delHub.cohorte, hoy);
      return { delHub, contexto };
    })(),
  ]);
  const periodo = resolverPeriodo(pedido, { hoy, inicio: contexto.inicio, anterior: contexto.anterior });
  const cohorteId = entrada.filtroDeCohorte ? delHub.cohorte?.id ?? null : null;
  const cohorteIdDeB = comparacionesDe(periodo)[0]?.conCohorteAnterior ? contexto.anterior?.id ?? null : cohorteId;
  const filtroDeCohorte: FiltroDeCohorteResuelto = {
    cohorteId,
    cohorteIdDeB,
    elegida: delHub.cohorte
      ? {
          id: delHub.cohorte.id,
          codigo: delHub.cohorte.codigo,
          metaCupos: delHub.cohorte.metaCupos,
          inicioVentas: delHub.cohorte.fechaInicioVentas,
          cierreVentas: delHub.cohorte.fechaCierreVentas,
        }
      : null,
    opciones: delHub.opciones,
    ventas: contexto.ventas,
  };
  // La proyección antigua se conserva para consumidores del dashboard.
  const equivalentes = { hoy: "hoy", esta_semana: "semana", este_mes: "mes" } as const;
  const seleccion: SeleccionDeRango = {
    preset: equivalentes[periodo.preset as keyof typeof equivalentes] ?? "custom",
    rango: periodo.a,
  };
  let closers: Promise<OpcionDeCloser[]> | null = null;
  return {
    seleccion,
    periodo,
    anteriorDisponible: contexto.anterior !== null,
    filtroDeCohorte,
    claveCloser,
    cohorte,
    cohorteIdDeB,
    closers: () => (closers ??= closersConCuenta({ programId, rango: periodo.a }, db)),
  };
}

export async function armarVistaDelDashboard(
  entrada: EntradaDeVista,
  db: Db = dbDeLaApp,
  contextoPrevio?: ContextoDeVista,
): Promise<VistaDelDashboard> {
  const { programId, hoy } = entrada;
  const contextoDeVista = contextoPrevio ?? await resolverContextoDeVista(entrada, db);
  const { seleccion, periodo, filtroDeCohorte, claveCloser, cohorte, cohorteIdDeB } = contextoDeVista;
  const { cohorteId } = filtroDeCohorte;
  const rango = periodo.a;

  const alcance = { programId, rango, claveCloser, cohorteId };
  const ahora = entrada.ahora ?? new Date();

  const [
    embudo,
    sinGrain,
    caja,
    contratado,
    ventasConValor,
    porCohorte,
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
    sinResultadoDelRango(alcance, ahora, db),
    banderasDelPulso({ programId, claveCloser, cohorteId }, db),
    contarCortesias(alcance, db),
    leadsDelRango(alcance, db),
    leerMetasDelMes(programId, hoy.slice(0, 7), hoy, db),
    embudoPorEtapas(db, { programId, rango, cohorteId }, ahora),
    embudoPorCloser({ programId, rango, cohorteId }, db, ahora),
    comisionesPorCloser({ programId, rango, cohorteId }, db),
    contextoDeVista.closers(),
    db.select({ comisionPorcentaje: programs.comisionPorcentaje }).from(programs).where(eq(programs.id, programId)),
    periodo.b
      ? Promise.all([
          embudoDelRango({ programId, rango: periodo.b, claveCloser, cohorteId: cohorteIdDeB }, db, ahora),
          cajaRecaudada({ programId, rango: periodo.b, claveCloser, cohorteId: cohorteIdDeB }, db),
          contratadoDelRango({ programId, rango: periodo.b, claveCloser, cohorteId: cohorteIdDeB }, db),
          dineroDelRango({ programId, rango: periodo.b, claveCloser, cohorteId: cohorteIdDeB }, db),
        ]).then(([embudoAnterior, cajaAnterior, contratadoAnterior, dineroAnterior]) => ({
          embudo: embudoAnterior,
          caja: cajaAnterior,
          contratadoUsd: contratadoAnterior.usd,
          dinero: dineroAnterior,
        }))
      : Promise.resolve(null),
  ]);
  const dinero = await dineroDeVentas(db, ventasConValor.map((venta) => venta.dealId));
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
    anteriorDisponible: contextoDeVista.anteriorDisponible,
    filtroDeCohorte,
    claveCloser,
    closers,
    embudo,
    anterior,
    contratadoUsd: contratado.usd,
    dinero,
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
