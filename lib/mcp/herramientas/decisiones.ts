import { z } from "zod";
import { manejaPauta, veStudents, veTableroDelPrograma } from "@/lib/auth/roles";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { estadoDeCobertura } from "@/lib/cobertura";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota, monto, num, pct } from "@/lib/format";
import { enlaceDeDeal, enlaceDeLead, enlaceDeSeccionHub } from "@/lib/mcp/enlaces";
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
import { busquedaDePeriodoMcp, camposDePeriodoMcp, type EntradaDePeriodoMcp } from "./periodo";
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
  descripcion:
    "Devuelve la cartera vencida que muestra Students, con sus mismos filtros de cohorte, onboarding, búsqueda y orden. " +
    "La fecha de corte es hoy en Bogotá; cada saldo conserva su moneda y cada fila enlaza al deal y a la persona. No pagina.",
  entrada: entradaCartera,
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
      .sort((a, b) => orden.get(a.dealId)! - orden.get(b.dealId)!)
      .map((fila) => ({
        ...fila,
        saldo: { valor: fila.saldo, moneda: fila.moneda, legible: fila.moneda ? monto(fila.saldo, fila.moneda) : "—" },
        enlace: enlaceDeDeal(visible.slug, fila.dealId),
        enlaceLead: enlaceDeLead(visible.slug, fila.leadId),
      }));
    return {
      texto: [
        `${num(vencidos.length)} en cartera vencida al ${hoy} (Bogotá).`,
        ...vencidos.map((fila) => `- ${fila.nombreLead ?? fila.emailLead} · ${fila.saldo.legible} · ${num(fila.diasDeAtraso)} días · ${fila.enlace}`),
      ].join("\n"),
      estructurado: {
        programa: { nombre: visible.nombre, slug: visible.slug },
        fechaDeCorte: hoy,
        filtros: { cohorte: resueltos.cohorte?.id ?? "todas", onboarding: resueltos.filtro.onboarded, q: entrada.q ?? null, orden: resueltos.orden },
        total: vencidos.length,
        filas: vencidos,
      },
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
  const entradaDeVista = { programId, hoy, periodo, preset: entrada.periodo };
  const resuelto = await resolverContextoDeVista(entradaDeVista, contexto.db);
  return { hoy, periodo: resuelto.periodo, rango: resuelto.seleccion.rango };
}

export const pautaRoasMcp: Herramienta<typeof entradaRoas> = {
  nombre: "pauta_roas",
  descripcion:
    "Devuelve el ROAS de Pauta para un periodo y nivel de la misma jerarquía del Hub: total, campaña, conjunto, anuncio, anuncio sin identificar o sin anuncio. " +
    "Las fechas son días de Bogotá. Vendido y gasto están en USD; la cobertura siempre acompaña al ROAS, parcial se declara y — significa que no se puede calcular. No pagina.",
  entrada: entradaRoas,
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
        `Registros: ${num(fila.registros)} · agendas: ${num(fila.agendas)} · shows: ${num(fila.shows)} · ventas: ${num(fila.ventas)}`,
        enlace,
      ].join("\n"),
      estructurado: {
        programa: { nombre: visible.nombre, slug: visible.slug },
        periodo: periodo.periodo,
        nivel,
        id: fila.id,
        nombre: fila.nombre,
        registros: fila.registros,
        agendas: fila.agendas,
        shows: fila.shows,
        noShows: fila.noShows,
        ventas: fila.ventas,
        vendido: { valor: fila.contratadoUsd, moneda: "USD", legible: monto(fila.contratadoUsd, "USD") },
        gasto: { valor: fila.gastoUsd, moneda: "USD", legible: monto(fila.gastoUsd, "USD") },
        roas: { ...fila.roas, estado, legible: roas },
        cobertura: vista.cobertura,
        enlace,
      },
    };
  },
};

const entradaOrigen = z.object({ programa, ...camposDePeriodoMcp }).strict();

export const origenDelProgramaMcp: Herramienta<typeof entradaOrigen> = {
  nombre: "origen_del_programa",
  descripcion:
    "Resume el origen de los registros de un programa para el periodo pedido, con los mismos canales del Hub, conteos y porcentajes. " +
    "Las fechas son días de Bogotá; Sin UTM siempre aparece con su conteo y porcentaje. No expone nombres técnicos ni pagina.",
  entrada: entradaOrigen,
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
        `Origen · ${periodo.rango.desde} a ${periodo.rango.hasta} (Bogotá) · ${num(vista.totalEnvios)} registros.`,
        ...canales.map((fila) => `- ${fila.nombre}: ${num(fila.registros)}${fila.porcentajeDelTotal === null ? "" : ` (${porcentaje(fila.porcentajeDelTotal)})`} · ${num(fila.agendas)} agendas (${porcentaje(fila.porcentajeAgenda)})`),
        enlace,
      ].join("\n"),
      estructurado: {
        programa: { nombre: visible.nombre, slug: visible.slug },
        periodo: periodo.periodo,
        totalRegistros: vista.totalEnvios,
        canales,
        precision,
        contenidoNoReconocido: vista.piezasDesconocidas.envios,
        enlace,
      },
    };
  },
};
