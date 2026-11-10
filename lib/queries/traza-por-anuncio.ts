import { and, between, count, eq } from "drizzle-orm";
import { resolverCanal } from "@/lib/atribucion/canal";
import { ARBOL_VACIO, emparejar } from "@/lib/atribucion/emparejar";
import { esEnvioPago, esPagoSinId } from "@/lib/atribucion/traza-sin-id";
import { columnasUtmDelEnvio, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";
import { pautaObjetos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { gastoConvertido } from "@/lib/queries/hechos/gasto";
import { fechaAnclaEnvio } from "@/lib/queries/metricas-filtros";

export interface FilaTraza {
  idMeta: string;
  nombre: string;
  campana: string;
  gastoCop: number;
  enviosPagosSinId: number;
}

export interface TrazaPorAnuncio {
  anuncios: FilaTraza[];
  sinAnuncioIdentificable: number;
  pagosTotales: number;
  pagosSinId: number;
  registros: { total: number; sinUtm: number; porcentajeSinUtm: number | null };
}

function nombreNormalizado(nombre: string | null): string | null {
  const limpio = nombre?.trim().toLowerCase();
  return limpio ? limpio : null;
}

export async function trazaPorAnuncio(
  db: Db,
  args: { programId: string; rango: { desde: string; hasta: string } },
): Promise<TrazaPorAnuncio> {
  const [gasto, objetos, grupos] = await Promise.all([
    gastoConvertido(db, args.programId, args.rango, "COP"),
    db.select({
      idMeta: pautaObjetos.idMeta,
      nivel: pautaObjetos.nivel,
      padreIdMeta: pautaObjetos.padreIdMeta,
      nombre: pautaObjetos.nombre,
    }).from(pautaObjetos).where(eq(pautaObjetos.programId, args.programId)),
    db.select({ ...columnasUtmDelEnvio, envios: count() })
      .from(submissions)
      .innerJoin(sources, eq(sources.id, submissions.sourceId))
      .where(and(
        eq(sources.programId, args.programId),
        eq(submissions.esParcial, false),
        between(fechaAnclaEnvio(), args.rango.desde, args.rango.hasta),
      ))
      .groupBy(...Object.values(columnasUtmDelEnvio)),
  ]);

  const porId = new Map(objetos.map((objeto) => [objeto.idMeta, objeto]));
  const anuncios = objetos.filter((objeto) => objeto.nivel === "anuncio");
  const anunciosPorNombre = new Map<string, typeof anuncios>();
  for (const anuncio of anuncios) {
    const nombre = nombreNormalizado(anuncio.nombre)!;
    anunciosPorNombre.set(nombre, [...(anunciosPorNombre.get(nombre) ?? []), anuncio]);
  }

  const enviosPorAnuncio = new Map<string, number>();
  let sinAnuncioIdentificable = 0;
  let pagosTotales = 0;
  let pagosSinId = 0;
  let total = 0;
  let sinUtm = 0;
  for (const grupo of grupos) {
    const utms = utmsDelEnvio(grupo);
    total += grupo.envios;
    if (resolverCanal(utms).regla === "sin_utm") sinUtm += grupo.envios;
    if (!esEnvioPago(utms)) continue;
    pagosTotales += grupo.envios;
    if (!esPagoSinId(utms)) continue;
    pagosSinId += grupo.envios;
    const contenido = emparejar(utms, ARBOL_VACIO).contenido;
    const nombre = contenido?.formato === "plantilla_pauta"
      ? contenido.anuncioNombre
      : contenido?.formato === "meta_historico"
        ? contenido.anuncio
        : null;
    const coincidencias = nombreNormalizado(nombre)
      ? anunciosPorNombre.get(nombreNormalizado(nombre)!) ?? []
      : [];
    if (coincidencias.length !== 1) {
      sinAnuncioIdentificable += grupo.envios;
      continue;
    }
    const idMeta = coincidencias[0].idMeta;
    enviosPorAnuncio.set(idMeta, (enviosPorAnuncio.get(idMeta) ?? 0) + grupo.envios);
  }

  const filas = anuncios.flatMap((anuncio): FilaTraza[] => {
    const gastoCop = gasto.porAnuncio.get(anuncio.idMeta) ?? 0;
    const enviosPagosSinId = enviosPorAnuncio.get(anuncio.idMeta) ?? 0;
    if (gastoCop <= 0 || enviosPagosSinId <= 0) return [];
    const conjunto = anuncio.padreIdMeta ? porId.get(anuncio.padreIdMeta) : undefined;
    const campana = conjunto?.padreIdMeta ? porId.get(conjunto.padreIdMeta) : undefined;
    return [{
      idMeta: anuncio.idMeta,
      nombre: anuncio.nombre,
      campana: campana?.nivel === "campana" ? campana.nombre : "—",
      gastoCop,
      enviosPagosSinId,
    }];
  }).sort((a, b) => b.gastoCop - a.gastoCop || a.idMeta.localeCompare(b.idMeta));

  return {
    anuncios: filas,
    sinAnuncioIdentificable,
    pagosTotales,
    pagosSinId,
    registros: { total, sinUtm, porcentajeSinUtm: total === 0 ? null : sinUtm / total },
  };
}
