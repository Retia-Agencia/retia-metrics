import { and, between, eq, inArray, sql } from "drizzle-orm";
import { emparejar, ARBOL_VACIO } from "@/lib/atribucion/emparejar";
import { columnasUtmDelEnvio, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { calls, canales, deals, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { RESULTADOS_QUE_OCURRIERON } from "@/lib/deals/mover-etapa";
import { fechaAnclaCall, vendidosEn, ventasConDiaEn } from "@/lib/queries/dashboard";
import type { AlcanceDeSerie, Serie } from "@/lib/queries/serie";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";

export type OrigenDelHecho = "canal" | "sin_utm" | "sin_clasificar" | "sin_envio_origen";

export interface DimensionesDelEmbudo {
  dia: string;
  areaId: string | null;
  canalId: string | null;
  origen: OrigenDelHecho;
  duenoUserId: string | null;
  cohorteId: string | null;
}

export interface MedidasDelEmbudo {
  envios: number;
  agendas: number;
  shows: number;
  ventas: number;
}

export type FilaHechosDelEmbudo = Serie<DimensionesDelEmbudo, MedidasDelEmbudo>[number];

const diaDeEnvio = () =>
  sql<string>`(${submissions.fechaEnvio} AT TIME ZONE 'America/Bogota')::date`;

/** Hechos del embudo, listos para filtrar o reagrupar sin cambiar la consulta. */
export async function hechosDelEmbudo(
  db: Db,
  { programId, rango }: AlcanceDeSerie,
): Promise<Serie<DimensionesDelEmbudo, MedidasDelEmbudo>> {
  const anclaCall = fechaAnclaCall();
  const [catalogo, envios, llamadas, ventas, diasDeVenta] = await Promise.all([
    db.select().from(canales).where(eq(canales.activo, true)),
    db
      .select({
        dia: diaDeEnvio(),
        ...columnasUtmDelEnvio,
        envios: sql<number>`count(*)::int`,
      })
      .from(submissions)
      .innerJoin(sources, eq(sources.id, submissions.sourceId))
      .where(
        and(
          eq(sources.programId, programId),
          eq(submissions.esParcial, false),
          between(diaDeEnvio(), rango.desde, rango.hasta),
        ),
      )
      .groupBy(
        diaDeEnvio(),
        ...Object.values(columnasUtmDelEnvio),
      ),
    db
      .select({
        dia: anclaCall,
        submissionId: submissions.id,
        duenoUserId: deals.ownerUserId,
        cohorteId: deals.cohortId,
        ...columnasUtmDelEnvio,
        agendas: sql<number>`count(*)::int`,
        shows: sql<number>`count(*) filter (where ${inArray(calls.resultado, [...RESULTADOS_QUE_OCURRIERON])})::int`,
      })
      .from(calls)
      .leftJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
      .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
      .where(
        and(
          eq(calls.programId, programId),
          between(anclaCall, rango.desde, rango.hasta),
          vigente(calls),
        ),
      )
      .groupBy(
        anclaCall,
        submissions.id,
        deals.ownerUserId,
        deals.cohortId,
        ...Object.values(columnasUtmDelEnvio),
      ),
    // Un deal por fila: el dia de su venta se une en memoria con `ventasConDiaEn`, que es la
    // misma definicion que `vendidosEn` (sin subconsulta, AGENTS.md).
    db
      .select({
        dealId: deals.id,
        submissionId: submissions.id,
        duenoUserId: deals.ownerUserId,
        cohorteId: deals.cohortId,
        ...columnasUtmDelEnvio,
      })
      .from(deals)
      .leftJoin(submissions, eq(submissions.id, deals.submissionOrigenId))
      .where(
        and(
          eq(deals.programId, programId),
          inArray(deals.id, vendidosEn(db, rango)),
          vigente(deals),
        ),
      ),
    ventasConDiaEn(db, rango),
  ]);

  const serie = new Map<string, FilaHechosDelEmbudo>();
  const sumar = (
    dimensiones: DimensionesDelEmbudo,
    medidas: Partial<MedidasDelEmbudo>,
  ) => {
    const llave = JSON.stringify([
      programId,
      dimensiones.dia,
      dimensiones.areaId,
      dimensiones.canalId,
      dimensiones.origen,
      dimensiones.duenoUserId,
      dimensiones.cohorteId,
    ]);
    const fila = serie.get(llave) ?? {
      programId,
      ...dimensiones,
      envios: 0,
      agendas: 0,
      shows: 0,
      ventas: 0,
    };
    fila.envios += medidas.envios ?? 0;
    fila.agendas += medidas.agendas ?? 0;
    fila.shows += medidas.shows ?? 0;
    fila.ventas += medidas.ventas ?? 0;
    serie.set(llave, fila);
  };

  const origenDe = (fila: Parameters<typeof utmsDelEnvio>[0], tieneEnvio: boolean) => {
    if (!tieneEnvio) return { areaId: null, canalId: null, origen: "sin_envio_origen" as const };
    const traza = emparejar(utmsDelEnvio(fila), catalogo, ARBOL_VACIO);
    return traza.origen.tipo === "canal"
      ? { areaId: traza.origen.canal.areaId, canalId: traza.origen.canal.id, origen: "canal" as const }
      : { areaId: null, canalId: null, origen: traza.origen.tipo };
  };

  for (const envio of envios) {
    sumar(
      {
        dia: envio.dia,
        ...origenDe(envio, true),
        duenoUserId: null,
        cohorteId: null,
      },
      { envios: envio.envios },
    );
  }
  for (const llamada of llamadas) {
    sumar(
      {
        dia: llamada.dia,
        ...origenDe(llamada, llamada.submissionId !== null),
        duenoUserId: llamada.duenoUserId,
        cohorteId: llamada.cohorteId,
      },
      { agendas: llamada.agendas, shows: llamada.shows },
    );
  }
  const diaDeVenta = new Map(diasDeVenta.map((v) => [v.dealId, v.dia]));
  for (const venta of ventas) {
    const dia = diaDeVenta.get(venta.dealId);
    // `vendidosEn` y `ventasConDiaEn` son la misma consulta: un deal vendido siempre tiene dia.
    if (dia === undefined) continue;
    sumar(
      {
        dia,
        ...origenDe(venta, venta.submissionId !== null),
        duenoUserId: venta.duenoUserId,
        cohorteId: venta.cohorteId,
      },
      { ventas: 1 },
    );
  }

  return [...serie.values()];
}
