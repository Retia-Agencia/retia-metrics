/** El norte recibe los cuatro cuadrantes ya calculados. No sigue los filtros del Hub. Módulo puro (419 E-2). */
import { num } from "@/lib/format";
import { armarCifra, type CifraDeMetrica, type EntradaDeCifra, type ExplicacionDeConcepto } from "@/lib/metricas/cifra";
import type { CeldaDeMeta, CuadranteDeMeta, VamosALlegar } from "@/lib/queries/vamos-a-llegar";

export const CONCEPTOS_DEL_NORTE = ["llevamos", "vendido", "faltan", "esperado_a_hoy", "por_dia_habil", "proyeccion"] as const;
export type ExplicacionesDelNorte = Record<(typeof CONCEPTOS_DEL_NORTE)[number], ExplicacionDeConcepto>;
export interface CifrasDeMeta {
  llevamos: CifraDeMetrica;
  faltan: CifraDeMetrica;
  esperado: CifraDeMetrica;
  porDiaHabil: CifraDeMetrica;
  proyeccion: CifraDeMetrica | null;
}

/** Los conceptos de cupos que se escriben con su decimal, como la barra ("de 8,8 · a hoy 4,6"): la misma cantidad, una forma. */
const CUPOS_CON_DECIMAL = new Set<keyof ExplicacionesDelNorte>(["faltan", "esperado_a_hoy", "por_dia_habil"]);
type ListaDelNorte = NonNullable<EntradaDeCifra["lista"]>;
/** La lista de cierres de cada horizonte; cuenta lo mismo que Llevamos (`tests/norte-evidencia.test.ts`). */
export interface ListasDelNorte { mes?: ListaDelNorte; cohorte?: ListaDelNorte }

export function cifrasDelNorte(e: { datos: VamosALlegar; programa: string; explicaciones: ExplicacionesDelNorte; listas?: ListasDelNorte }) {
  const filtros = [["Programa", e.programa]] as const;
  const cuadrante = (q: CuadranteDeMeta, periodo: string, proyectar: boolean, razon: string | null, lista?: ListaDelNorte) => {
    const celda = (c: CeldaDeMeta, moneda: boolean): CifrasDeMeta => {
      const parcial = moneda && q.ventasSinValorVendido > 0
        ? `${num(q.ventasSinValorVendido)} ventas no tienen valor vendido: el total está incompleto.` : undefined;
      const cifra = (concepto: keyof ExplicacionesDelNorte, valor: number | null, motivo?: string) => armarCifra({
        concepto, explicacion: { ...e.explicaciones[concepto], unidad: moneda ? "usd" : CUPOS_CON_DECIMAL.has(concepto) ? "decimal" : e.explicaciones[concepto].unidad },
        valor, motivo: valor === null ? motivo ?? (c.meta === null ? "Sin meta configurada" : "Faltan las fechas de la ventana de ventas") : undefined,
        filtros, periodo, parcial: concepto === "esperado_a_hoy" ? undefined : parcial,
        ...(concepto === "llevamos" || concepto === "vendido" ? {
          estado: c.esperado === null ? undefined : { fuente: "esperado" as const, llevamos: c.llevamos, esperado: c.esperado },
          avance: c.meta !== null && c.meta > 0 && c.esperado !== null ? {
            llevamos: c.llevamos, meta: c.meta, esperado: c.esperado, fraccionDeTiempo: c.esperado / c.meta,
            de: moneda ? "valor vendido" : "cupos", ambito: periodo,
            origenDeLaMeta: "La meta configurada para este horizonte de ventas.", dias: "días hábiles de la ventana de ventas",
          } : undefined,
          linea: c.meta === null ? { antes: "Sin meta configurada" } : undefined,
          lista,
        } : {}),
      });
      return {
        llevamos: cifra(moneda ? "vendido" : "llevamos", c.llevamos),
        faltan: cifra("faltan", c.faltan), esperado: cifra("esperado_a_hoy", c.esperado),
        porDiaHabil: cifra("por_dia_habil", c.porDiaHabil),
        proyeccion: proyectar ? cifra("proyeccion", c.proyeccion, razon ?? "No hay ritmo suficiente para proyectar") : null,
      };
    };
    return { cupos: celda(q.cupos, false), usd: celda(q.usd, true) };
  };
  return {
    mes: cuadrante(e.datos.mes.cuadrante, `mes de ${e.datos.mes.nombre}`, false, null, e.listas?.mes),
    cohorte: e.datos.cohorte ? cuadrante(e.datos.cohorte.cuadrante, `cohorte ${e.datos.cohorte.codigo} hasta hoy`, true, e.datos.cohorte.razonProyeccion, e.listas?.cohorte) : null,
  };
}
