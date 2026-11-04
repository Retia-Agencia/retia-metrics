import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "@/lib/db/tipos";
import { diasHabilesEntre, esperadoLineal, metaDeHoy } from "@/lib/dias-habiles";
import { alertasDelPrograma, type Alerta } from "@/lib/queries/alertas";
import { cohorteActiva } from "@/lib/queries/cohortes";
import {
  armarMetasDelMes,
  leerCohortesYVentas,
  nombreDelMes,
  type CohorteParaMetas,
  type VentaParaMetas,
} from "@/lib/queries/metas";
import { leerProyeccion } from "@/lib/queries/proyeccion";
import { contratadoDeDeals, type ContratadoDeDeals } from "@/lib/queries/saldo";
import { ventasDeLaCohorte } from "@/lib/queries/ventas-de-la-cohorte";

/**
 * "¿Vamos a llegar?" (371, `docs/hub.md` §0 G-7): lo que llevamos contra la meta del mes y de la
 * cohorte activa, en cupos y en USD. Son las cuatro combinaciones, siempre, y NO dependen de ningun
 * filtro: la funcion recibe solo programa y hoy (ADR 0023: la meta es de la cohorte, no se reparte).
 *
 * Una sola definicion por cifra (ADR 0115 N1): ventas = `ventasDeLaCohorte` / `leerCohortesYVentas`
 * (352); esperado y por dia habil = `lib/dias-habiles.ts`; Vendido = `contratadoDeDeals`; proyeccion =
 * `leerProyeccion` (253). Esta funcion solo las junta.
 */

export type TonoDeMeta = "ok" | "atencion" | "peligro" | "neutro";

export interface CeldaDeMeta {
  llevamos: number;
  /** Nula = sin meta configurada: la pantalla lo dice, nunca pinta 0 %. */
  meta: number | null;
  pct: number | null;
  faltan: number | null;
  /** Nulo si la ventana no tiene fechas (cohorte "por definir"): no se inventa un dia. */
  esperado: number | null;
  /** Meta de apertura de hoy (352): lo que faltaba al abrir hoy entre los habiles que quedan contando hoy. */
  porDiaHabil: number | null;
  /** Solo la cohorte; nula sin ritmo (la razon vive en `razonProyeccion`). */
  proyeccion: number | null;
  tono: TonoDeMeta;
}

export interface CuadranteDeMeta {
  cupos: CeldaDeMeta;
  usd: CeldaDeMeta;
  /** Ventas del cuadrante a las que el closer no les escribio el valor vendido: el USD "llevamos" es parcial. */
  ventasSinValorVendido: number;
  diasHabilesQueQuedan: number;
}

export interface VamosALlegar {
  hoy: string;
  mes: { clave: string; nombre: string; cierre: string; sinMeta: boolean; cuadrante: CuadranteDeMeta };
  cohorte:
    | { id: string; codigo: string; cierre: string | null; desdeLista: string; sinMeta: boolean; razonProyeccion: string | null; cuadrante: CuadranteDeMeta }
    | null;
}

const VACIO = (llevamos: number): CeldaDeMeta => ({
  llevamos, meta: null, pct: null, faltan: null, esperado: null, porDiaHabil: null, proyeccion: null, tono: "neutro",
});

/** Una celda: la misma cuenta para cupos y para USD, solo cambia la unidad de lo que entra. */
export function celdaDeMeta(args: {
  llevamos: number;
  meta: number | null;
  esperado: number | null;
  /** Lo llevado antes de hoy, en la misma unidad (alimenta la meta de hoy; las ventas de hoy no se descuentan). */
  antesDeHoy: number;
  hoy: string;
  cierre: string | null;
  proyeccion?: number | null;
  umbral?: Pick<Alerta, "aceptable" | "disparada"> | null;
}): CeldaDeMeta {
  if (args.meta === null || args.meta <= 0) return VACIO(args.llevamos);
  const cumplimiento = args.esperado === null || args.esperado <= 0 ? null : args.llevamos / args.esperado;
  const tono: TonoDeMeta = !args.umbral || cumplimiento === null
    ? "neutro"
    : args.umbral.disparada
      ? "peligro"
      : cumplimiento * 100 < args.umbral.aceptable
        ? "atencion"
        : "ok";
  return {
    llevamos: args.llevamos,
    meta: args.meta,
    pct: args.llevamos / args.meta,
    faltan: Math.max(args.meta - args.llevamos, 0),
    esperado: args.esperado,
    porDiaHabil: args.cierre === null
      ? null
      : metaDeHoy({ meta: args.meta, vendidosAntesDeHoy: args.antesDeHoy, hoy: args.hoy, cierre: args.cierre }),
    proyeccion: args.proyeccion ?? null,
    tono,
  };
}

function ultimoDiaDelMes(mes: string): string {
  const [anio, numero] = mes.split("-").map(Number);
  const dia = new Date(Date.UTC(anio, numero, 0)).getUTCDate();
  return `${mes}-${String(dia).padStart(2, "0")}`;
}

/** Lo ya leido de la base, sin reloj: lo que `armarVamosALlegar` necesita. */
export interface EntradaDeVamosALlegar {
  hoy: string;
  cohortes: readonly CohorteParaMetas[];
  /** Ventas del programa con su dia, hasta hoy (las del mes y las de la cohorte). */
  ventas: readonly VentaParaMetas[];
  /** Vendido (USD) de los cuatro grupos de ventas; sale de `contratadoDeDeals` sobre `idsParaVendido`. */
  vendido: Record<keyof ReturnType<typeof idsParaVendido>, ContratadoDeDeals>;
  cohorteActiva: { id: string; ventasDeLaCohorte: readonly { dealId: string; dia: string }[] } | null;
  proyeccion: { valor: number | null; razon: string | null } | null;
  umbrales: readonly Pick<Alerta, "metrica" | "aceptable" | "disparada">[];
}

/** Los cuatro grupos de ventas cuyo Vendido hace falta: mes y cohorte, con y sin las de hoy. */
export function idsParaVendido(
  hoy: string,
  ventas: readonly VentaParaMetas[],
  ventasCohorte: readonly { dealId: string; dia: string }[],
) {
  const mes = hoy.slice(0, 7);
  const delMes = ventas.filter((v) => v.dia.slice(0, 7) === mes && v.dia <= hoy);
  return {
    mes: delMes.map((v) => v.dealId),
    mesAntes: delMes.filter((v) => v.dia < hoy).map((v) => v.dealId),
    cohorte: ventasCohorte.map((v) => v.dealId),
    cohorteAntes: ventasCohorte.filter((v) => v.dia < hoy).map((v) => v.dealId),
  };
}

/** Arma las cuatro combinaciones sin base ni reloj. */
export function armarVamosALlegar(entrada: EntradaDeVamosALlegar): VamosALlegar {
  const { hoy } = entrada;
  const mesClave = hoy.slice(0, 7);
  const finDeMes = ultimoDiaDelMes(mesClave);
  const umbralDe = (metrica: Alerta["metrica"]) => entrada.umbrales.find((u) => u.metrica === metrica) ?? null;

  // MES: la meta del mes de 146 (`armarMetasDelMes`), sin reescribirla.
  const metasMes = armarMetasDelMes({ cohortes: entrada.cohortes, ventas: entrada.ventas, mes: mesClave, hoy });
  const precioPorCohorte = new Map(entrada.cohortes.map((c) => [c.id, c.precioUsd]));
  const ids = idsParaVendido(hoy, entrada.ventas, entrada.cohorteActiva?.ventasDeLaCohorte ?? []);
  const esperadoUsdMes = metasMes.filas.reduce(
    (total, fila) => total + fila.esperado * (fila.cohorteId ? precioPorCohorte.get(fila.cohorteId) ?? 0 : 0),
    0,
  );
  const mesSinMeta = metasMes.mesSinVentana || metasMes.metaCupos <= 0;
  const umbralMes = umbralDe("meta_mes");
  const mes: VamosALlegar["mes"] = {
    clave: mesClave,
    nombre: nombreDelMes(mesClave),
    cierre: finDeMes,
    sinMeta: mesSinMeta,
    cuadrante: {
      cupos: celdaDeMeta({
        llevamos: ids.mes.length, meta: mesSinMeta ? null : metasMes.metaCupos, esperado: metasMes.esperado,
        antesDeHoy: ids.mesAntes.length, hoy, cierre: finDeMes, umbral: umbralMes,
      }),
      usd: celdaDeMeta({
        llevamos: entrada.vendido.mes.usd, meta: mesSinMeta ? null : metasMes.metaUsd,
        esperado: esperadoUsdMes, antesDeHoy: entrada.vendido.mesAntes.usd, hoy, cierre: finDeMes,
        umbral: umbralMes,
      }),
      ventasSinValorVendido: entrada.vendido.mes.sinValorVendido,
      diasHabilesQueQuedan: diasHabilesEntre(hoy, finDeMes),
    },
  };

  // COHORTE: la activa, con su meta de cupos y la misma regla de USD que el mes: cupos x precio de la cohorte.
  const activa = entrada.cohorteActiva && entrada.cohortes.find((c) => c.id === entrada.cohorteActiva!.id);
  if (!activa || !entrada.cohorteActiva) return { hoy, mes, cohorte: null };
  const ventasCohorte = entrada.cohorteActiva.ventasDeLaCohorte;
  const metaCupos = activa.metaCupos;
  const metaUsd = metaCupos * activa.precioUsd;
  const ventana = activa.fechaInicioVentas && activa.fechaCierreVentas
    ? { inicio: activa.fechaInicioVentas, cierre: activa.fechaCierreVentas }
    : null;
  const esperadoCupos = ventana ? esperadoLineal({ meta: metaCupos, ...ventana, hasta: hoy }) : null;
  const esperadoUsd = ventana ? esperadoLineal({ meta: metaUsd, ...ventana, hasta: hoy }) : null;
  const llevamosUsd = entrada.vendido.cohorte.usd;
  const proyectados = entrada.proyeccion?.valor ?? null;
  // Los cupos que la proyeccion ve sin vender se valoran al precio de la cohorte: la misma regla de la meta.
  const proyeccionUsd = proyectados === null ? null : llevamosUsd + Math.max(proyectados - ventasCohorte.length, 0) * activa.precioUsd;
  const umbralCohorte = umbralDe("meta_cohorte");
  const sinMetaCohorte = metaCupos <= 0;
  return {
    hoy,
    mes,
    cohorte: {
      id: activa.id,
      codigo: activa.codigo,
      cierre: activa.fechaCierreVentas,
      // La lista de la cohorte parte del dia mas viejo que cuenta: el inicio de ventas o una venta anterior (DA-2).
      desdeLista: [...(activa.fechaInicioVentas ? [activa.fechaInicioVentas] : []), ...ventasCohorte.map((v) => v.dia)].sort()[0] ?? hoy,
      sinMeta: sinMetaCohorte,
      razonProyeccion: entrada.proyeccion?.razon ?? null,
      cuadrante: {
        cupos: celdaDeMeta({
          llevamos: ventasCohorte.length, meta: metaCupos, esperado: esperadoCupos, antesDeHoy: ids.cohorteAntes.length,
          hoy, cierre: ventana?.cierre ?? null, proyeccion: proyectados, umbral: umbralCohorte,
        }),
        usd: celdaDeMeta({
          llevamos: llevamosUsd, meta: metaUsd, esperado: esperadoUsd,
          antesDeHoy: entrada.vendido.cohorteAntes.usd, hoy, cierre: ventana?.cierre ?? null,
          proyeccion: proyeccionUsd, umbral: umbralCohorte,
        }),
        ventasSinValorVendido: entrada.vendido.cohorte.sinValorVendido,
        diasHabilesQueQuedan: ventana ? diasHabilesEntre(hoy, ventana.cierre) : 0,
      },
    },
  };
}

/** Lee lo necesario y arma. Recibe SOLO programa y hoy: ningun filtro de la URL entra aqui. */
export async function leerVamosALlegar(programId: string, hoy: string, db: Db = dbDeLaApp): Promise<VamosALlegar> {
  const mesClave = hoy.slice(0, 7);
  const [{ cohortes, ventas }, activa, alertas, proyeccion] = await Promise.all([
    leerCohortesYVentas(db, programId, { desde: `${mesClave}-01`, hasta: hoy }),
    cohorteActiva(programId, db),
    alertasDelPrograma(programId, hoy, db),
    leerProyeccion({ programId, hoy }, db),
  ]);
  const ventasDeLaActiva = activa ? await ventasDeLaCohorte(db, activa.id, hoy) : [];
  const grupos = idsParaVendido(hoy, ventas, ventasDeLaActiva);
  const [mes, mesAntes, cohorte, cohorteAntes] = await Promise.all([
    contratadoDeDeals(db, grupos.mes), contratadoDeDeals(db, grupos.mesAntes),
    contratadoDeDeals(db, grupos.cohorte), contratadoDeDeals(db, grupos.cohorteAntes),
  ]);
  return armarVamosALlegar({
    hoy,
    cohortes,
    ventas,
    vendido: { mes, mesAntes, cohorte, cohorteAntes },
    cohorteActiva: activa ? { id: activa.id, ventasDeLaCohorte: ventasDeLaActiva } : null,
    proyeccion: activa ? proyeccion.proyeccion : null,
    umbrales: alertas,
  });
}
