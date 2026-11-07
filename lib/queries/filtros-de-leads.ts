import { z } from "zod";
import { hoyEnBogota } from "@/lib/format";
import { atajosDePeriodo, filtroDeFechaDeLaUrl, type FiltroDeFecha } from "@/lib/periodo";
import { MINIMO_TEXTO_BUSQUEDA } from "@/lib/queries/busqueda-de-leads";
import {
  CALIDADES_DE_LEAD,
  CAMPOS_DE_FECHA_DE_LEAD,
  ORDENES_DE_LEADS,
  SENTIDOS_DE_ORDEN_DE_LEADS,
  type CampoDeFechaDeLead,
  type FiltroLeads,
} from "@/lib/queries/leads";

const PERIODOS = [...Object.keys(atajosDePeriodo), "custom"] as const;
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa una fecha AAAA-MM-DD de Bogotá.");

/** Esquema compartido por la URL de Leads y `buscar_leads`. */
export const camposDeFiltrosDeLeads = {
  q: z.string().min(MINIMO_TEXTO_BUSQUEDA),
  deal: z.enum(["con", "sin"]).optional(),
  calidad: z.enum(CALIDADES_DE_LEAD).optional(),
  abandono: z.boolean().optional(),
  duplicado: z.boolean().optional(),
  fecha: z.enum(CAMPOS_DE_FECHA_DE_LEAD).optional(),
  periodo: z.enum(PERIODOS).optional(),
  a_desde: fecha.optional(),
  a_hasta: fecha.optional(),
  orden: z.enum(ORDENES_DE_LEADS).optional(),
  sentido: z.enum(SENTIDOS_DE_ORDEN_DE_LEADS).optional(),
};

function uno(valor: unknown): string | undefined {
  if (Array.isArray(valor)) return typeof valor[0] === "string" ? valor[0] : undefined;
  return typeof valor === "string" ? valor : undefined;
}

export function filtrosDeLeads(
  entrada: Record<string, unknown>,
  pagina: number,
  hoy: string = hoyEnBogota(),
): { filtro: FiltroLeads; filtroDeFecha: FiltroDeFecha<CampoDeFechaDeLead> | null } {
  const deal = uno(entrada.deal);
  const calidadCruda = uno(entrada.calidad);
  const calidad = CALIDADES_DE_LEAD.find((valor) => valor === calidadCruda) ?? null;
  const campo = uno(entrada.orden);
  const sentido = uno(entrada.sentido);
  const orden = ORDENES_DE_LEADS.includes(campo as (typeof ORDENES_DE_LEADS)[number])
    && SENTIDOS_DE_ORDEN_DE_LEADS.includes(sentido as (typeof SENTIDOS_DE_ORDEN_DE_LEADS)[number])
    ? { campo: campo as (typeof ORDENES_DE_LEADS)[number], sentido: sentido as (typeof SENTIDOS_DE_ORDEN_DE_LEADS)[number] }
    : { campo: "actividad", sentido: "desc" } as const;
  const filtroDeFecha = filtroDeFechaDeLaUrl(entrada, CAMPOS_DE_FECHA_DE_LEAD, hoy);
  return {
    filtro: {
      q: uno(entrada.q) ?? "",
      deal: deal === "con" || deal === "sin" ? deal : null,
      calidad,
      abandono: entrada.abandono === true || uno(entrada.abandono) === "1",
      duplicado: entrada.duplicado === true || uno(entrada.duplicado) === "1",
      fecha: filtroDeFecha ? { campo: filtroDeFecha.campo, rango: filtroDeFecha.periodo.a } : null,
      orden,
      pagina,
    },
    filtroDeFecha,
  };
}
