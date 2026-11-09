import { z } from "zod";
import { manejaPauta, veStudents, veTableroDelPrograma } from "@/lib/auth/roles";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { estadoDeCobertura } from "@/lib/cobertura";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota, monto, num, pct } from "@/lib/format";
import { enlaceDeDeal, enlaceDeLead, enlaceDeSeccionHub } from "@/lib/mcp/enlaces";
import { aSalidaDeCarteraVencida, aSalidaDeOrigenDelPrograma, aSalidaDePautaRoas, salidaDeCarteraVencida, salidaDeOrigenDelPrograma, salidaDePautaRoas } from "@/lib/mcp/salidas/decisiones";
import { parsearPeriodoUrl } from "@/lib/periodo";
import { carteraVencida } from "@/lib/queries/cartera";
import { leadsQueCasan } from "@/lib/queries/busqueda-de-leads";
import {
  ONBOARDING_STUDENTS,
  resolverFiltroStudents,
  studentsDelPrograma,
  VALORES_ORDEN_STUDENTS,
} from "@/lib/queries/estudiantes";
import { PRECISION_PAID, origenDelPrograma, resumenDeOrigen } from "@/lib/queries/origen";
import { cargarRoasDePauta, NIVEL_PAUTA_POR_DEFECTO, NIVELES_PAUTA, renglonRoasDeVista } from "@/lib/queries/roas-de-pauta";
import { resolverContextoDeVista } from "@/lib/queries/vista-dashboard";
import { busquedaDePeriodoMcp, camposDePeriodoMcp, presetDePeriodoMcp, type EntradaDePeriodoMcp } from "./periodo";
import { programaVisible } from "./programa";
import type { ContextoMcp, Herramienta } from "./tipos";

const programa = z.string().min(1).max(100);

async function programaVisibleConCapacidad(
  contexto: ContextoMcp,
  slug: string,
  capacidad: (rol: ContextoMcp["rol"]) => boolean,
) {
  if (!capacidad(contexto.rol)) throw new ErrorDeApp("No existe ese programa", 404);
  return programaVisible(contexto, slug);
}

const entradaCartera = z.object({
  programa,
  cohorte: z.string().min(1).max(100).optional(),
  onboarding: z.enum(ONBOARDING_STUDENTS).optional(),
  q: z.string().max(200).optional(),
  orden: z.enum(VALORES_ORDEN_STUDENTS).optional(),
}).strict();

export const carteraVencidaMcp: Herramienta<typeof entradaCartera> = {
  nombre: "cartera_vencida",
  titulo: "Cartera vencida",
  descripcion:
    "Úsala cuando necesites saber quién tiene saldos vencidos en un programa. Devuelve la cartera vencida que muestra Students, con sus mismos filtros de cohorte, onboarding, búsqueda y orden. " +
    "La fecha de corte es hoy en Bogotá; cada saldo conserva su moneda y cada fila enlaza al deal y a la persona. No pagina.",
  entrada: entradaCartera,
  salida: salidaDeCarteraVencida,
  puede: (contexto) => veStudents(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisibleConCapacidad(contexto, entrada.programa, veStudents);
    const [cohortes, leadsCasan] = await Promise.all([
      listarCohortes(contexto.db, visible.id),
      leadsQueCasan(contexto.db, visible.id, entrada.q ?? ""),
    ]);
    const resueltos = resolverFiltroStudents({ ...entrada, cohortes, leadsCasan });
    const hoy = hoyEnBogota();
    const [students, cartera] = await Promise.all([
      studentsDelPrograma(contexto.db, visible.id, resueltos.filtro, hoy),
      carteraVencida(contexto.db, visible.id, hoy, resueltos.cohorte?.id),
    ]);
    const orden = new Map(students.map((fila, indice) => [fila.dealId, indice]));
    const vencidos = cartera.vencidos
      .filter((fila) => orden.has(fila.dealId))
      .sort((a, b) => orden.get(a.dealId)! - orden.get(b.dealId)!);
    const estructurado = aSalidaDeCarteraVencida(
      { ...cartera, vencidos }, { nombre: visible.nombre, slug: visible.slug }, hoy,
      { cohorte: resueltos.cohorte?.id ?? "todas", onboarding: resueltos.filtro.onboarded, busqueda: entrada.q ?? null, orden: resueltos.orden },
      { deal: (id) => enlaceDeDeal(visible.slug, id), persona: (id) => enlaceDeLead(visible.slug, id) },
      monto,
    );
    return {
      texto: [
        `${num(vencidos.length)} en cartera vencida al ${hoy} (Bogotá).`,
        ...estructurado.filas.map((fila) => `- ${fila.nombre ?? fila.email} · ${fila.saldo?.legible ?? "—"} · ${num(fila.dias_de_atraso)} días · ${fila.enlace}`),
      ].join("\n"),
      estructurado,
    };
  },
};

const entradaRoas = z.object({
  programa,
  ...camposDePeriodoMcp,
  nivel: z.enum(NIVELES_PAUTA).default(NIVEL_PAUTA_POR_DEFECTO),
  id: z.string().min(1).max(200).optional(),
}).strict();

async function rangoDelHub(contexto: ContextoMcp, programId: string, entrada: EntradaDePeriodoMcp) {
  const hoy = hoyEnBogota();
  const periodo = parsearPeriodoUrl(busquedaDePeriodoMcp(entrada));
  const entradaDeVista = { programId, hoy, periodo, preset: presetDePeriodoMcp(entrada) };
  const resuelto = await resolverContextoDeVista(entradaDeVista, contexto.db);
  return { hoy, periodo: resuelto.periodo, rango: resuelto.seleccion.rango };
}

export const pautaRoasMcp: Herramienta<typeof entradaRoas> = {
  nombre: "pauta_roas",
  titulo: "ROAS de pauta",
  descripcion:
    "Úsala cuando necesites evaluar el rendimiento de pauta por nivel. Devuelve el ROAS para un periodo y para la misma jerarquía del Hub: total, campaña, conjunto, anuncio, anuncio sin identificar o sin anuncio. " +
    "Las fechas son días de Bogotá. Vendido y gasto están en USD; la cobertura siempre acompaña al ROAS, parcial se declara y — significa que no se puede calcular. No pagina.",
  entrada: entradaRoas,
  salida: salidaDePautaRoas,
  puede: (contexto) => manejaPauta(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisibleConCapacidad(contexto, entrada.programa, manejaPauta);
    const periodo = await rangoDelHub(contexto, visible.id, entrada);
    const vista = await cargarRoasDePauta(contexto.db, visible.id, periodo.rango, periodo.hoy);
    const nivel = entrada.nivel ?? NIVEL_PAUTA_POR_DEFECTO;
    const fila = renglonRoasDeVista(vista, nivel, entrada.id);
    if (!fila) throw new ErrorDeApp("No existe ese nivel de pauta", 404);
    const estado = estadoDeCobertura(fila.roas);
    const roas = fila.roas.valor === null ? "—" : `${num(fila.roas.valor, 2)}${estado === "parcial" ? " (parcial)" : ""}`;
    const enlace = enlaceDeSeccionHub(visible.slug, "pauta");
    return {
      texto: [
        `${fila.nombre} · ${periodo.rango.desde} a ${periodo.rango.hasta} (Bogotá)`,
        `ROAS: ${roas} · cobertura ${num(fila.roas.base)} de ${num(fila.roas.base + fila.roas.faltan)}${fila.roas.motivo ? ` · ${fila.roas.motivo}` : ""}`,
        `Vendido: ${monto(fila.contratadoUsd, "USD")} · gasto: ${monto(fila.gastoUsd, "USD")}`,
        `Envíos: ${num(fila.registros)} · agendadas: ${num(fila.agendas)} · realizadas: ${num(fila.shows)} · ventas: ${num(fila.ventas)}`,
        enlace,
      ].join("\n"),
      estructurado: aSalidaDePautaRoas({ programa: { nombre: visible.nombre, slug: visible.slug }, periodo: periodo.rango, fila, vista, estado, roasLegible: roas, enlace, dineroLegible: monto }),
    };
  },
};

const entradaOrigen = z.object({ programa, ...camposDePeriodoMcp }).strict();

export const origenDelProgramaMcp: Herramienta<typeof entradaOrigen> = {
  nombre: "origen_del_programa",
  titulo: "Origen del programa",
  descripcion:
    "Úsala cuando necesites entender de dónde llegaron los envíos de un programa. Devuelve el resumen del periodo con los mismos canales del Hub, conteos y porcentajes. " +
    "Las fechas son días de Bogotá; Sin UTM siempre aparece con su conteo y porcentaje. No expone nombres técnicos ni pagina.",
  entrada: entradaOrigen,
  salida: salidaDeOrigenDelPrograma,
  puede: (contexto) => veTableroDelPrograma(contexto.rol),
  soloLectura: true,
  async ejecutar(contexto, entrada) {
    const visible = await programaVisibleConCapacidad(contexto, entrada.programa, veTableroDelPrograma);
    const periodo = await rangoDelHub(contexto, visible.id, entrada);
    const vista = await origenDelPrograma(contexto.db, { programId: visible.id, rango: periodo.rango, hoy: periodo.hoy });
    const canales = resumenDeOrigen(vista);
    const precision = PRECISION_PAID.map((item) => ({
      titulo: item.titulo,
      detalle: item.detalle,
      registros: vista.trazaPaid[item.nivel],
    }));
    const enlace = enlaceDeSeccionHub(visible.slug, "origen");
    const porcentaje = (valor: number | null) => valor === null ? "—" : pct(valor);
    return {
      texto: [
        `Origen · ${periodo.rango.desde} a ${periodo.rango.hasta} (Bogotá) · ${num(vista.totalEnvios)} envíos.`,
        ...canales.map((fila) => `- ${fila.nombre}: ${num(fila.registros)}${fila.porcentajeDelTotal === null ? "" : ` (${porcentaje(fila.porcentajeDelTotal)})`} · ${num(fila.agendas)} agendas (${porcentaje(fila.porcentajeAgenda)})`),
        enlace,
      ].join("\n"),
      estructurado: aSalidaDeOrigenDelPrograma({ programa: { nombre: visible.nombre, slug: visible.slug }, periodo: periodo.rango, vista, canales, precision, enlace }),
    };
  },
};
