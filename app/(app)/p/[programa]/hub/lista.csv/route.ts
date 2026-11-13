import { z } from "zod";
import { esquema } from "@/app/(app)/p/[programa]/hub/lista/page";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { requireSession, respuestaDeError } from "@/lib/auth/guards";
import { esAdministrador, veEquipoComercial } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota } from "@/lib/format";
import { csvDeLeadsDeLista, csvDeTraza } from "@/lib/hub/csv-historia";
import { fichasDeLeads } from "@/lib/queries/ficha-lead";
import { recorridoDeLeads } from "@/lib/queries/hechos/recorrido";
import { capacidadParaMetrica, TAMANO_PAGINA, type FilaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { combinacionDeFiltrosValida, normalizarFiltrosDeOrigen, tipoDeLista } from "@/lib/queries/filtros-de-lista";
import { vistaDeLista } from "@/lib/queries/vista-metrica";

export const runtime = "nodejs";

const esquemaCsv = esquema.extend({ forma: z.enum(["leads", "traza"]) });

export async function GET(request: Request, { params }: { params: Promise<{ programa: string }> }) {
  try {
    const session = await requireSession();
    const rol = await rolDeVista(session);
    const url = new URL(request.url);
    const busqueda = Object.fromEntries(url.searchParams.entries());
    const validado = esquemaCsv.parse(busqueda);
    const { tieneOrigen } = tipoDeLista(validado);
    if (!capacidadParaMetrica({ metrica: validado.metrica, tieneOrigen })(rol)) {
      throw new ErrorDeApp("No tienes permiso para descargar esta lista.", 403);
    }
    const { programa: slug } = await params;
    const programa = await programaVisiblePorSlug(session.user.id, rol, slug, db);
    if (!programa) throw new ErrorDeApp("No encontrado.", 404);
    if (!combinacionDeFiltrosValida(validado, { esAdmin: esAdministrador(rol) })) {
      throw new ErrorDeApp("No encontrado.", 404);
    }

    const { source, medium, canal, campaign } = normalizarFiltrosDeOrigen(validado);
    const entrada = {
      programId: programa.id,
      metrica: validado.metrica,
      busqueda,
      hoy: hoyEnBogota(),
      codigoCloser: validado.closer,
      moneda: validado.moneda,
      cohorteId: validado.cohorte,
      origenDeal: validado.origen,
      etapa: validado.etapa,
      antiguedad: validado.antiguedad,
      source,
      medium,
      campaign,
      resultado: validado.resultado,
      categoria: validado.categoria,
      orden: validado.orden,
      area: validado.area,
      canal,
      escalon: validado.escalon,
      grupo: validado.grupo,
      calidad: validado.calidad,
      pago: validado.pago,
      nivel: validado.nivel,
      idMeta: validado.id,
      paso: validado.paso,
    } as const;
    const primera = await vistaDeLista({ ...entrada, pagina: 1 }, db);
    if (!primera) throw new ErrorDeApp("No encontrado.", 404);
    const paginas = Math.ceil(primera.lista.subtotal.cantidad / TAMANO_PAGINA);
    const filas: FilaDeMetrica[] = [...primera.lista.filas];
    for (let pagina = 2; pagina <= paginas; pagina += 1) {
      const vista = await vistaDeLista({ ...entrada, pagina }, db);
      if (!vista) throw new ErrorDeApp("No encontrado.", 404);
      filas.push(...vista.lista.filas);
    }

    const filasPorLead = new Map<string, FilaDeMetrica>();
    for (const fila of filas) {
      const leadId = fila.persona?.leadId;
      if (leadId && !filasPorLead.has(leadId)) filasPorLead.set(leadId, fila);
    }
    // ponytail: 5.000 es el techo operativo de personas por archivo.
    if (filasPorLead.size > 5_000) {
      throw new ErrorDeApp("Son más de 5.000 personas: acota el periodo o los filtros.", 422);
    }
    const leadIds = [...filasPorLead.keys()];
    const fichas = await fichasDeLeads(db, programa.id, leadIds);
    const veEquipo = veEquipoComercial(rol);
    const cuerpo = validado.forma === "leads"
      ? csvDeLeadsDeLista({ filas: [...filasPorLead.values()], fichas, veEquipo })
      : csvDeTraza({ leadIds, fichas, recorridos: await recorridoDeLeads(db, programa.id, leadIds), veEquipo });
    const prefijo = validado.forma === "leads" ? "leads" : "historia";
    return new Response(cuerpo, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${prefijo}-${programa.slug}-${hoyEnBogota()}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
