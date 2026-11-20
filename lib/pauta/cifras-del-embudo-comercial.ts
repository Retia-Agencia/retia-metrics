import { armarCifra, type CifraDeMetrica } from "@/lib/metricas/cifra";
import { explicacionesDeRecorridos } from "@/lib/metricas/explicacion";
import type { CorteResuelto } from "@/lib/pauta/corte-de-pauta";
import type { PasoEmbudoComercial, MetricaDelEmbudoComercial } from "@/lib/queries/embudo-comercial";
import type { GrupoDelEmbudoComercial, NivelDeEmbudoComercial } from "@/lib/queries/embudo-comercial-por-pauta";

/** Las cuatro columnas de la tabla por campaña y anuncio, en orden, con su concepto y su métrica de lista. */
export const PASOS_DE_LA_TABLA = [
  { paso: "creados", etiqueta: "Deals creados", concepto: "embudo_comercial_creados", metrica: "embudo_comercial_creados" },
  { paso: "agendaron", etiqueta: "Agendaron", concepto: "embudo_comercial_agendaron", metrica: "embudo_comercial_agendaron" },
  { paso: "tuvieron_show", etiqueta: "Tuvieron show", concepto: "embudo_comercial_tuvieron_show", metrica: "embudo_comercial_shows" },
  { paso: "compraron", etiqueta: "Compraron", concepto: "embudo_comercial_compraron", metrica: "embudo_comercial_compraron" },
] as const satisfies readonly { paso: PasoEmbudoComercial; etiqueta: string; concepto: string; metrica: MetricaDelEmbudoComercial }[];

/** El enlace a la lista `embudo_comercial_*` de un corte (campaña o anuncio) de Meta. */
export type EnlaceDeCelda = (
  corte: { nivel: NivelDeEmbudoComercial; corteId: string } | null,
  metrica: MetricaDelEmbudoComercial,
) => string;

export interface CeldaDelEmbudoComercial {
  cantidad: CifraDeMetrica;
  porcentaje: CifraDeMetrica;
}

export interface FilaDeLaTablaDelEmbudo {
  clave: string;
  nombre: string;
  celdas: CeldaDelEmbudoComercial[];
}

export interface ContextoDeLaTablaDelEmbudo {
  nivel: NivelDeEmbudoComercial;
  programa: string;
  periodo: string;
  /** Mapea el id de Meta de un grupo al UUID del corte de pauta; sin él, la celda no abre lista. */
  corteId: (idMeta: string) => string | undefined;
  enlace?: EnlaceDeCelda;
}

/** Una fila de la tabla: las cuatro celdas con su cantidad y su porcentaje del paso anterior. */
export function filaDeLaTablaDelEmbudo(
  grupo: GrupoDelEmbudoComercial,
  c: ContextoDeLaTablaDelEmbudo,
): FilaDeLaTablaDelEmbudo {
  const explicaciones = explicacionesDeRecorridos();
  const filtros: Array<readonly [string, string]> = [
    ["Programa", c.programa],
    ["Área", "Paid"],
    [c.nivel === "campana" ? "Campaña" : "Anuncio", grupo.nombre],
    ["Periodo", c.periodo],
  ];
  const corteId = grupo.idMeta === null ? undefined : c.corteId(grupo.idMeta);
  const corte = corteId !== undefined ? { nivel: c.nivel, corteId } : null;
  const celdas = PASOS_DE_LA_TABLA.map(({ paso, concepto, metrica }) => {
    const encontrado = grupo.pasos.find((p) => p.paso === paso)!;
    return {
      cantidad: armarCifra({
        concepto, explicacion: explicaciones[concepto]!, valor: encontrado.cantidad, filtros, periodo: c.periodo,
        lista: c.enlace && encontrado.cantidad > 0
          ? { href: c.enlace(corte, metrica), nombre: "deals", total: encontrado.cantidad, filas: [], articulo: "los" }
          : undefined,
      }),
      porcentaje: armarCifra({
        concepto: "conversion_del_paso", explicacion: explicaciones.conversion_del_paso!, valor: encontrado.pctDelPaso,
        filtros, periodo: c.periodo, motivo: "El paso anterior no tiene deals",
      }),
    };
  });
  return { clave: grupo.idMeta ?? "sin-campana", nombre: grupo.nombre, celdas };
}

export function filasDeLaTablaDelEmbudo(
  grupos: readonly GrupoDelEmbudoComercial[],
  c: ContextoDeLaTablaDelEmbudo,
): FilaDeLaTablaDelEmbudo[] {
  return grupos.map((grupo) => filaDeLaTablaDelEmbudo(grupo, c));
}
