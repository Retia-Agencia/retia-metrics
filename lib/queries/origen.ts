import { and, eq, inArray, sql } from "drizzle-orm";
import { textoDeRegla, tipoDePlantilla, type Area } from "@/lib/atribucion/canal";
import { emparejarFilaDeEnvio, type Traza } from "@/lib/atribucion/emparejar";
import { cuentasPublicitarias, pautaObjetos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { arbolDePauta } from "@/lib/pauta/arbol";
import { agruparTrazas as agruparTrazasDeAgendas } from "@/lib/queries/hechos/agenda";
import { agruparTrazas } from "@/lib/queries/hechos/envio";
import type { Rango } from "@/lib/queries/dashboard";

export interface FilaOrigenUtm {
  source: string | null;
  medium: string | null;
  envios: number;
  agendas: number;
  area: Area;
  canal: string;
  cuenta: string | null;
  regla: string;
  nivel: Traza["nivel"];
  nuevo: boolean;
  macros: boolean;
}

export interface PlantillasDeCuenta {
  cuenta: string;
  vieja: number;
  pauta: number;
  otra: number;
  sinId: number;
}

export interface VistaOrigen {
  filas: FilaOrigenUtm[];
  totalEnvios: number;
  sinUtm: number;
  macros: number;
  trazaPaid: Record<"N3" | "N2" | "N1", number>;
  plantillas: PlantillasDeCuenta[];
}

const clavePar = (source: string | null, medium: string | null) => JSON.stringify([source, medium]);
const claveFila = (source: string | null, medium: string | null, regla: Traza["origen"]["regla"]) =>
  JSON.stringify([source, medium, regla]);

export async function origenDelPrograma(
  db: Db,
  args: { programId: string; rango: Rango; hoy: string },
): Promise<VistaOrigen> {
  const [{ grupos, primeros }, agendas, arbol, anuncios] = await Promise.all([
    agruparTrazas(db, args),
    agruparTrazasDeAgendas(db, args),
    arbolDePauta(db, args.programId),
    db.select({
      cuenta: cuentasPublicitarias.nombre,
      tags: pautaObjetos.urlTags,
      anuncios: sql<number>`count(*)::int`,
    }).from(pautaObjetos)
      .innerJoin(cuentasPublicitarias, eq(cuentasPublicitarias.id, pautaObjetos.cuentaId))
      .where(and(
        eq(pautaObjetos.programId, args.programId),
        eq(pautaObjetos.nivel, "anuncio"),
        inArray(pautaObjetos.estado, ["ACTIVE", "active"]),
        eq(cuentasPublicitarias.activo, true),
      ))
      .groupBy(cuentasPublicitarias.nombre, pautaObjetos.urlTags),
  ]);

  const agendasPorFila = new Map<string, {
    source: string | null;
    medium: string | null;
    traza: Traza;
    agendas: number;
    macros: boolean;
    niveles: Record<Traza["nivel"], number>;
  }>();
  for (const grupo of agendas) {
    const traza = emparejarFilaDeEnvio(grupo, arbol);
    const clave = claveFila(grupo.utmSource, grupo.utmMedium, traza.origen.regla);
    const actual = agendasPorFila.get(clave) ?? {
      source: grupo.utmSource,
      medium: grupo.utmMedium,
      traza,
      agendas: 0,
      macros: false,
      niveles: { N3: 0, N2: 0, N1: 0, N0: 0 },
    };
    actual.agendas += grupo.agendas;
    actual.macros ||= traza.macros.length > 0;
    actual.niveles[traza.nivel] += grupo.agendas;
    agendasPorFila.set(clave, actual);
  }
  const nuevoPorPar = new Map(primeros.map((fila) => [
    clavePar(fila.utmSource, fila.utmMedium),
    fila.nuevo,
  ]));
  const porParYRegla = new Map<string, FilaOrigenUtm & { niveles: Record<Traza["nivel"], number> }>();
  for (const grupo of grupos) {
    const traza = emparejarFilaDeEnvio(grupo, arbol);
    const par = clavePar(grupo.utmSource, grupo.utmMedium);
    const clave = claveFila(grupo.utmSource, grupo.utmMedium, traza.origen.regla);
    const actual = porParYRegla.get(clave) ?? {
      source: grupo.utmSource,
      medium: grupo.utmMedium,
      envios: 0,
      agendas: agendasPorFila.get(clave)?.agendas ?? 0,
      area: traza.origen.area,
      canal: traza.origen.canal?.nombre ?? "Sin UTM",
      cuenta: traza.origen.canal?.cuenta ?? null,
      regla: textoDeRegla(traza.origen, { source: grupo.utmSource, medium: grupo.utmMedium }),
      nivel: traza.nivel,
      nuevo: nuevoPorPar.get(par) ?? false,
      macros: false,
      niveles: { N3: 0, N2: 0, N1: 0, N0: 0 },
    };
    actual.envios += grupo.envios;
    actual.macros ||= traza.macros.length > 0;
    actual.niveles[traza.nivel] += grupo.envios;
    porParYRegla.set(clave, actual);
  }
  // Una agenda puede caer en el rango aunque su envío de origen sea anterior. Esa regla también
  // forma una fila: el universo de filas es la unión de envíos y agendas, no solo los envíos.
  for (const [clave, agenda] of agendasPorFila) {
    if (porParYRegla.has(clave)) continue;
    const par = clavePar(agenda.source, agenda.medium);
    porParYRegla.set(clave, {
      source: agenda.source,
      medium: agenda.medium,
      envios: 0,
      agendas: agenda.agendas,
      area: agenda.traza.origen.area,
      canal: agenda.traza.origen.canal?.nombre ?? "Sin UTM",
      cuenta: agenda.traza.origen.canal?.cuenta ?? null,
      regla: textoDeRegla(agenda.traza.origen, { source: agenda.source, medium: agenda.medium }),
      nivel: agenda.traza.nivel,
      nuevo: nuevoPorPar.get(par) ?? false,
      macros: agenda.macros,
      niveles: agenda.niveles,
    });
  }
  const filas = [...porParYRegla.values()].map(({ niveles, ...fila }) => ({
    ...fila,
    nivel: (Object.entries(niveles) as Array<[Traza["nivel"], number]>)
      .sort(([a, ca], [b, cb]) => cb - ca || b.localeCompare(a))[0][0],
  })).sort((a, b) => b.envios - a.envios || a.canal.localeCompare(b.canal) || a.regla.localeCompare(b.regla));
  const totalEnvios = filas.reduce((total, fila) => total + fila.envios, 0);
  const trazaPaid = { N3: 0, N2: 0, N1: 0 };
  for (const fila of filas) if (fila.area === "paid" && fila.nivel !== "N0") trazaPaid[fila.nivel] += fila.envios;

  const plantillas = new Map<string, PlantillasDeCuenta>();
  for (const anuncio of anuncios) {
    const fila = plantillas.get(anuncio.cuenta) ?? { cuenta: anuncio.cuenta, vieja: 0, pauta: 0, otra: 0, sinId: 0 };
    const tipo = tipoDePlantilla(anuncio.tags);
    fila[tipo === "sin_id" ? "sinId" : tipo] += anuncio.anuncios;
    plantillas.set(anuncio.cuenta, fila);
  }
  return {
    filas,
    totalEnvios,
    sinUtm: filas.filter((fila) => fila.area === "sin_utm").reduce((n, fila) => n + fila.envios, 0),
    macros: filas.filter((fila) => fila.macros).reduce((n, fila) => n + fila.envios, 0),
    trazaPaid,
    plantillas: [...plantillas.values()].sort((a, b) => a.cuenta.localeCompare(b.cuenta)),
  };
}
