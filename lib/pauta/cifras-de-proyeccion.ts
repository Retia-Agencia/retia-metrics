/**
 * "¿Qué ROAS esperamos cuando ocurran las citas que faltan?" como dos Cifras (ticket 419 paso 3,
 * `docs/diseno-cifra-y-pauta.md` §4.5). Recibe lo que ya calculó `calcularProyeccionDeRoas` y lo vuelve
 * `CifraDeMetrica`; no consulta la base ni recalcula el ROAS. Módulo PURO.
 */
import type { ObjetivoDeCohorte } from "@/lib/catalogo/objetivos";
import { fechaCorta, num, pct } from "@/lib/format";
import { armarCifra, formatearValor, type CifraDeMetrica } from "@/lib/metricas/cifra";
import { explicacionDePauta } from "@/lib/metricas/explicaciones-de-pauta";
import { estadoDeCeldaSemanal } from "@/lib/pauta/cifra-de-celda-semanal";
import { etiquetaDeSemana } from "@/lib/pauta/csv-tabla-semanal";
import type { ProyeccionDeRoas, ProyeccionGuardada } from "@/lib/queries/proyeccion-roas";

export interface EntradaDeCifrasDeProyeccion {
  proyeccion: ProyeccionDeRoas;
  historial: readonly ProyeccionGuardada[];
  objetivos: readonly ObjetivoDeCohorte[];
  hoy: string;
  programa?: string;
  cohorte?: string;
}

const veces = (n: number) => formatearValor("veces", n);
const citas = (n: number) => `${num(n)} ${n === 1 ? "cita" : "citas"}`;

/** La última proyección que ya tiene lo real al lado: la que dice si el modelo acierta. */
export function ultimaConfirmada(historial: readonly ProyeccionGuardada[]): ProyeccionGuardada | null {
  return [...historial].filter((h) => h.roasReal !== null).sort((a, b) => b.dia.localeCompare(a.dia))[0] ?? null;
}

export function cifrasDeProyeccion(e: EntradaDeCifrasDeProyeccion): { aHoy: CifraDeMetrica; proyectado: CifraDeMetrica } {
  const p = e.proyeccion;
  const n = p.citasPendientes;
  const periodo = `del ${etiquetaDeSemana(p.rango)}`;
  const filtros: Array<readonly [string, string]> = [];
  if (e.programa) filtros.push(["Programa", e.programa]);
  if (e.cohorte) filtros.push(["Cohorte", e.cohorte]);
  filtros.push(["Área", "Paid"]);
  filtros.push(["Periodo", etiquetaDeSemana(p.rango)]);
  const enCurso = p.rango.hasta >= e.hoy;
  const pendientes = n > 0 ? { antes: "", cifra: num(n), despues: ` ${n === 1 ? "cita" : "citas"} de pauta pendientes` } : undefined;

  const aHoy = armarCifra({
    concepto: "roas",
    explicacion: explicacionDePauta("roas"),
    valor: p.roasAHoy.valor,
    motivo: p.roasAHoy.valor === null ? p.roasAHoy.motivo ?? "Falta el gasto del periodo" : undefined,
    partes: [p.vendidoUsd, p.gastoUsd],
    periodo,
    filtros,
    enCurso,
    parcial: p.roasAHoy.valor !== null && n > 0
      ? `Faltan ${citas(n)} de estos registros: lo vendido todavía puede subir cuando ocurran.`
      : p.roasAHoy.valor !== null && p.roasAHoy.faltan > 0 ? p.roasAHoy.motivo ?? "Falta parte del gasto." : undefined,
    estado: estadoDeCeldaSemanal("roas", e.objetivos),
    linea: pendientes,
  });

  const confirmada = ultimaConfirmada(e.historial);
  const supuestos = p.valor === null ? [] : p.supuestos.porCloser.map((s): readonly [string, string] => [
    s.closer ?? "Sin closer",
    `${citas(s.citas)} pendientes: se presenta ${pct(s.pShow!)} y compra ${pct(s.pCierre!)}`
      + (s.usaPrograma
        ? `, con la tasa del programa (tiene ${num(s.muestra)} ${s.muestra === 1 ? "persona" : "personas"} con cita y se piden ${num(p.supuestos.muestraMinima)}).`
        : `, con sus ${num(s.muestra)} personas con cita.`),
  ]);
  const proyectado = armarCifra({
    concepto: "roas_proy",
    explicacion: explicacionDePauta("roas_proy"),
    valor: p.valor,
    motivo: p.valor === null ? p.motivo ?? "No hay historial suficiente para proyectar" : undefined,
    partes: [p.vendidoUsd + p.esperadoUsd, p.gastoUsd],
    periodo,
    filtros,
    enCurso,
    linea: confirmada
      ? {
        antes: `Proyectado el ${fechaCorta(confirmada.dia)}: `,
        cifra: confirmada.roasProyectado === null ? "—" : veces(confirmada.roasProyectado),
        despues: ` · real: ${veces(confirmada.roasReal!)}`,
      }
      : undefined,
    notas: [
      ...(confirmada ? [["Proyectado y real", `El ${fechaCorta(confirmada.dia)} se proyectó ${confirmada.roasProyectado === null ? "«—»" : veces(confirmada.roasProyectado)}; cuando ocurrieron esas citas, el ROAS fue ${veces(confirmada.roasReal!)}. Sirve para saber cuánto creerle a la proyección.`] as const] : []),
      ...supuestos,
    ],
  });
  return { aHoy, proyectado };
}
