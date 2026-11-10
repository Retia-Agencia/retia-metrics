import { and, eq } from "drizzle-orm";
import { objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import { db as dbDeLaApp } from "@/lib/db";
import { cohorts } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esperadoLineal } from "@/lib/dias-habiles";
import { cohorteActiva, type Cohorte } from "@/lib/queries/cohortes";
import { dineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import { agrupar as agruparAgendas } from "@/lib/queries/hechos/agenda";
import { gastoConvertido } from "@/lib/queries/hechos/gasto";
import { listar as listarVentas } from "@/lib/queries/hechos/venta";
import { leerProyeccion, type ValorDeProyeccion } from "@/lib/queries/proyeccion";
import { ventasDeLaCohorte } from "@/lib/queries/ventas-de-la-cohorte";

export const UMBRAL_EN_META = 1;
export const UMBRAL_EN_SEGUIMIENTO = 0.65;

export type EstadoDeCumplimiento = "en_meta" | "en_seguimiento" | "rezagado";

export const VARIANTE_POR_ESTADO = {
  en_meta: "exito",
  en_seguimiento: "alerta",
  rezagado: "peligro",
} as const;

export const ETIQUETA_POR_ESTADO: Record<EstadoDeCumplimiento, string> = {
  en_meta: "En meta",
  en_seguimiento: "En seguimiento",
  rezagado: "Rezagado",
};

export function estadoDeCumplimiento({ llevamos, meta, esperado }: {
  llevamos: number;
  meta: number | null;
  esperado: number | null;
}): { estado: EstadoDeCumplimiento; ratio: number } | null {
  if (meta === null || meta <= 0 || esperado === null || esperado <= 0) return null;
  const ratio = (llevamos / meta) / (esperado / meta);
  if (llevamos >= meta || ratio >= UMBRAL_EN_META) return { estado: "en_meta", ratio };
  if (ratio >= UMBRAL_EN_SEGUIMIENTO) return { estado: "en_seguimiento", ratio };
  return { estado: "rezagado", ratio };
}

export interface MedidaDeCumplimiento {
  llevamos: number;
  meta: number;
  esperado: number | null;
  desfase: number | null;
  cumplimiento: ReturnType<typeof estadoDeCumplimiento>;
}

export interface BarraDeCumplimiento {
  cupos: MedidaDeCumplimiento;
  usd: MedidaDeCumplimiento | null;
}

export interface CumplimientoDeCohorteLeido {
  cohorte: {
    id: string;
    codigo: string;
    cierre: string | null;
    cerrada: boolean;
  } | null;
  agendas: BarraDeCumplimiento | null;
  ventasPauta: BarraDeCumplimiento | null;
  ventasTotales: BarraDeCumplimiento | null;
  inversion: { llevamos: number; meta: number } | null;
  requeridos: {
    agendasDia: ValorDeProyeccion;
    inversionDiaMeta: number | null;
    inversionDiaPromedio: number | null;
    metaCumplida: boolean;
    cierre: string;
  } | null;
}

export interface EntradaDeCumplimiento {
  hoy: string;
  cohorte: Pick<Cohorte, "id" | "codigo" | "metaCupos" | "precioUsd" | "fechaInicioVentas" | "fechaCierreVentas"> | null;
  esActiva: boolean;
  ventasTotales: { cantidad: number; vendidoUsd: number };
  ventasPauta: { cantidad: number; vendidoUsd: number };
  agendas: number;
  metas: { agendas: number | null; ventasPauta: number | null; costoPorAgenda: number | null; inversion: number | null };
  gastoCop: number;
  proyeccion: { agendasRequeridasDia: ValorDeProyeccion; faltan: number } | null;
}

function medida(llevamos: number, meta: number, esperado: number | null): MedidaDeCumplimiento {
  return {
    llevamos,
    meta,
    esperado,
    desfase: esperado === null ? null : esperado - llevamos,
    cumplimiento: estadoDeCumplimiento({ llevamos, meta, esperado }),
  };
}

function esperado(meta: number, cohorte: NonNullable<EntradaDeCumplimiento["cohorte"]>, hoy: string): number | null {
  if (!cohorte.fechaInicioVentas || !cohorte.fechaCierreVentas) return null;
  return esperadoLineal({ meta, inicio: cohorte.fechaInicioVentas, cierre: cohorte.fechaCierreVentas, hasta: hoy });
}

/** Une cifras ya leidas sin base ni reloj. */
export function armarCumplimiento(entrada: EntradaDeCumplimiento): CumplimientoDeCohorteLeido {
  const c = entrada.cohorte;
  if (!c) return { cohorte: null, agendas: null, ventasPauta: null, ventasTotales: null, inversion: null, requeridos: null };
  const precioUsd = Number(c.precioUsd);
  const cerrada = c.fechaCierreVentas !== null && entrada.hoy > c.fechaCierreVentas;
  const barraVentas = (datos: { cantidad: number; vendidoUsd: number }, meta: number): BarraDeCumplimiento => {
    const esperadoCupos = esperado(meta, c, entrada.hoy);
    const metaUsd = meta * precioUsd;
    return {
      cupos: medida(datos.cantidad, meta, esperadoCupos),
      usd: medida(datos.vendidoUsd, metaUsd, esperadoCupos === null ? null : esperadoCupos * precioUsd),
    };
  };
  const metaAgendas = entrada.metas.agendas;
  const agendas = metaAgendas === null ? null : {
    cupos: medida(entrada.agendas, metaAgendas, esperado(metaAgendas, c, entrada.hoy)),
    usd: null,
  };
  const metaCumplida = metaAgendas !== null && entrada.agendas >= metaAgendas || entrada.proyeccion?.faltan === 0;
  const agendasDia = entrada.proyeccion?.agendasRequeridasDia ?? null;
  const valorAgendasDia = agendasDia?.valor ?? null;
  return {
    cohorte: { id: c.id, codigo: c.codigo, cierre: c.fechaCierreVentas, cerrada },
    agendas,
    ventasPauta: entrada.metas.ventasPauta === null ? null : barraVentas(entrada.ventasPauta, entrada.metas.ventasPauta),
    ventasTotales: barraVentas(entrada.ventasTotales, c.metaCupos),
    inversion: entrada.metas.inversion === null ? null : { llevamos: entrada.gastoCop, meta: entrada.metas.inversion },
    requeridos: entrada.esActiva && !cerrada && c.fechaCierreVentas && agendasDia ? {
      agendasDia,
      inversionDiaMeta: valorAgendasDia === null || entrada.metas.costoPorAgenda === null
        ? null
        : valorAgendasDia * entrada.metas.costoPorAgenda,
      inversionDiaPromedio: valorAgendasDia === null || entrada.agendas <= 0
        ? null
        : valorAgendasDia * (entrada.gastoCop / entrada.agendas),
      metaCumplida: Boolean(metaCumplida),
      cierre: c.fechaCierreVentas,
    } : null,
  };
}

async function cohorteElegida(programId: string, cohorteId: string | null, db: Db): Promise<Cohorte | null> {
  if (cohorteId === null) return cohorteActiva(programId, db);
  const [fila] = await db.select().from(cohorts).where(and(eq(cohorts.id, cohorteId), eq(cohorts.programId, programId))).limit(1);
  return fila ?? null;
}

export async function leerCumplimientoDeCohorte(
  programId: string,
  cohorteId: string | null,
  hoy: string,
  db: Db = dbDeLaApp,
): Promise<CumplimientoDeCohorteLeido> {
  const [cohorte, activa] = await Promise.all([cohorteElegida(programId, cohorteId, db), cohorteActiva(programId, db)]);
  if (!cohorte) return armarCumplimiento({
    hoy, cohorte: null, esActiva: false,
    ventasTotales: { cantidad: 0, vendidoUsd: 0 }, ventasPauta: { cantidad: 0, vendidoUsd: 0 },
    agendas: 0, metas: { agendas: null, ventasPauta: null, costoPorAgenda: null, inversion: null },
    gastoCop: 0, proyeccion: null,
  });
  const rangoAgendas = cohorte.fechaInicioVentas ? { desde: cohorte.fechaInicioVentas, hasta: hoy } : null;
  const esActiva = activa?.id === cohorte.id;
  const cerrada = cohorte.fechaCierreVentas !== null && hoy > cohorte.fechaCierreVentas;
  const [ventasTotales, ventasPauta, gruposAgendas, objetivos, proyeccion] = await Promise.all([
    ventasDeLaCohorte(db, cohorte.id, hoy),
    listarVentas(db, {
      programId,
      rango: { desde: "2000-01-01", hasta: hoy },
      filtros: { cohorte: [cohorte.id], area: ["paid"] },
      // Todas las ventas de la cohorte (DA-2). ponytail: tope de 10.000 ventas por cohorte; la escala de hoy es de cientos.
      pagina: { limite: 10_000, offset: 0 },
    }),
    rangoAgendas ? agruparAgendas(db, { programId, rango: rangoAgendas, agruparPor: [], filtros: { cohorte: [cohorte.id] } }) : Promise.resolve([]),
    objetivosDeCohortes(db, [cohorte.id]),
    esActiva && !cerrada ? leerProyeccion({ programId, hoy }, db) : Promise.resolve(null),
  ]);
  const activos = objetivos.filter((o) => o.activo);
  const meta = (metrica: typeof activos[number]["metrica"], area: typeof activos[number]["area"]) =>
    activos.find((o) => o.metrica === metrica && o.area === area)?.meta ?? null;
  const agendas = gruposAgendas.reduce((total, grupo) => total + grupo.agendas, 0);
  const idsTotales = ventasTotales.map((venta) => venta.dealId);
  const idsPauta = ventasPauta.filas.map((venta) => venta.dealId);
  const necesitaGasto = cohorte.fechaInicioVentas !== null;
  const [dineroTotal, dineroPauta, gasto] = await Promise.all([
    dineroDeVentas(db, idsTotales),
    dineroDeVentas(db, idsPauta),
    necesitaGasto
      ? gastoConvertido(db, programId, { desde: cohorte.fechaInicioVentas!, hasta: hoy }, "COP")
      : Promise.resolve(null),
  ]);
  return armarCumplimiento({
    hoy,
    cohorte,
    esActiva,
    ventasTotales: { cantidad: ventasTotales.length, vendidoUsd: dineroTotal.vendido },
    ventasPauta: { cantidad: ventasPauta.filas.length, vendidoUsd: dineroPauta.vendido },
    agendas,
    metas: {
      agendas: meta("agendas", null),
      ventasPauta: meta("cupos", "paid"),
      costoPorAgenda: meta("costo_por_agenda", null),
      inversion: meta("inversion", null),
    },
    // `gastoConvertido` conserva el nombre historico `totalUsd`, aunque el valor esta en `destino` (COP aqui).
    gastoCop: gasto?.totalUsd ?? 0,
    proyeccion: proyeccion ? { agendasRequeridasDia: proyeccion.agendasRequeridasDia, faltan: proyeccion.faltan } : null,
  });
}
