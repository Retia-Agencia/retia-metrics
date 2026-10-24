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
  canalClave: string | null;
  cuenta: string | null;
  regla: string;
  nivel: Traza["nivel"];
  nuevo: boolean;
  macros: boolean;
}

export interface FilaOrigenCanal {
  clave: string;
  area: Area;
  canal: string;
  canalClave: string | null;
  envios: number;
  agendas: number;
  categoria: "sin_utm" | "macro" | null;
  pares: FilaOrigenUtm[];
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
  canales: FilaOrigenCanal[];
  totalEnvios: number;
  trazaPaid: Record<"N3" | "N2" | "N1", number>;
  plantillas: PlantillasDeCuenta[];
}

const clavePar = (source: string | null, medium: string | null) => JSON.stringify([source, medium]);
const claveFila = (
  source: string | null,
  medium: string | null,
  regla: Traza["origen"]["regla"],
  macros: boolean,
) => JSON.stringify([source, medium, regla, macros]);

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
    const macros = traza.macros.length > 0;
    const clave = claveFila(grupo.utmSource, grupo.utmMedium, traza.origen.regla, macros);
    const actual = agendasPorFila.get(clave) ?? {
      source: grupo.utmSource,
      medium: grupo.utmMedium,
      traza,
      agendas: 0,
      macros,
      niveles: { N3: 0, N2: 0, N1: 0, N0: 0 },
    };
    actual.agendas += grupo.agendas;
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
    const macros = traza.macros.length > 0;
    const clave = claveFila(grupo.utmSource, grupo.utmMedium, traza.origen.regla, macros);
    const actual = porParYRegla.get(clave) ?? {
      source: grupo.utmSource,
      medium: grupo.utmMedium,
      envios: 0,
      agendas: agendasPorFila.get(clave)?.agendas ?? 0,
      area: traza.origen.area,
      canal: traza.origen.canal?.nombre ?? "Sin UTM",
      canalClave: traza.origen.canal?.clave ?? null,
      cuenta: traza.origen.canal?.cuenta ?? null,
      regla: textoDeRegla(traza.origen, { source: grupo.utmSource, medium: grupo.utmMedium }),
      nivel: traza.nivel,
      nuevo: nuevoPorPar.get(par) ?? false,
      macros,
      niveles: { N3: 0, N2: 0, N1: 0, N0: 0 },
    };
    actual.envios += grupo.envios;
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
      canalClave: agenda.traza.origen.canal?.clave ?? null,
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

  const porCanal = new Map<string, FilaOrigenCanal>();
  const sumarCanal = (
    clave: string,
    area: Area,
    canal: string,
    canalClave: string | null,
    categoria: FilaOrigenCanal["categoria"],
    par: FilaOrigenUtm,
  ) => {
    const actual = porCanal.get(clave) ?? { clave, area, canal, canalClave, categoria, envios: 0, agendas: 0, pares: [] };
    actual.envios += par.envios;
    actual.agendas += par.agendas;
    actual.pares.push(par);
    porCanal.set(clave, actual);
  };
  for (const fila of filas) {
    if (fila.macros) sumarCanal("macro", "sin_utm", "Macros sin expandir", null, "macro", fila);
    else if (fila.area === "sin_utm") sumarCanal("sin_utm", "sin_utm", "Sin UTM", null, "sin_utm", fila);
    else sumarCanal(`${fila.area}:${fila.canalClave}`, fila.area, fila.canal, fila.canalClave, null, fila);
  }
  for (const especial of [
    { clave: "sin_utm", canal: "Sin UTM", categoria: "sin_utm" as const },
    { clave: "macro", canal: "Macros sin expandir", categoria: "macro" as const },
  ]) {
    if (!porCanal.has(especial.clave)) porCanal.set(especial.clave, {
      ...especial, area: "sin_utm", canalClave: null, envios: 0, agendas: 0, pares: [],
    });
  }
  const canales = [...porCanal.values()].sort((a, b) => {
    if (a.categoria !== null || b.categoria !== null) {
      if (a.categoria === null) return -1;
      if (b.categoria === null) return 1;
      return a.categoria === "sin_utm" ? -1 : 1;
    }
    return b.envios - a.envios || a.canal.localeCompare(b.canal) || a.area.localeCompare(b.area);
  });

  const plantillas = new Map<string, PlantillasDeCuenta>();
  for (const anuncio of anuncios) {
    const fila = plantillas.get(anuncio.cuenta) ?? { cuenta: anuncio.cuenta, vieja: 0, pauta: 0, otra: 0, sinId: 0 };
    const tipo = tipoDePlantilla(anuncio.tags);
    fila[tipo === "sin_id" ? "sinId" : tipo] += anuncio.anuncios;
    plantillas.set(anuncio.cuenta, fila);
  }
  return {
    filas,
    canales,
    totalEnvios,
    trazaPaid,
    plantillas: [...plantillas.values()].sort((a, b) => a.cuenta.localeCompare(b.cuenta)),
  };
}
