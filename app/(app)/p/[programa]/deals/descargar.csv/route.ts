import { alcanceDeDeals } from "@/lib/auth/alcance-deals";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { requireRole, respuestaDeError } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { fechaHoraEnBogota, hoyEnBogota } from "@/lib/format";
import { ETAPAS, NOMBRE_DE_ETAPA, NOMBRE_DE_PENDIENTE, type EtapaDeal } from "@/lib/deals/etapas";
import { csvDeDeals } from "@/lib/deals/csv-deals";
import { dealsParaCsv } from "@/lib/queries/deals-para-csv";

export const runtime = "nodejs";

/** Descarga de la lista de deals: `?etapas=potencial,registrado`. Mismo alcance que el tablero. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ programa: string }> },
) {
  try {
    const session = await requireRole("gerente", "closer");
    const { programa: slug } = await params;
    const rol = await rolDeVista(session);
    const programa = esRolValido(rol) ? await programaVisiblePorSlug(session.user.id, rol, slug, db) : null;
    if (!programa) throw new ErrorDeApp("No encontrado.", 404);

    const url = new URL(request.url);
    const pedidas = (url.searchParams.get("etapas") ?? "").split(",").filter(Boolean);
    const etapas = ETAPAS.filter((e) => pedidas.includes(e));
    if (etapas.length === 0 || etapas.length !== new Set(pedidas).size) {
      throw new ErrorDeApp("Elige al menos una etapa válida.", 400);
    }

    const alcance = await alcanceDeDeals(session);
    const filas = await dealsParaCsv(db, programa.id, alcance, etapas);
    const csv = csvDeDeals(
      filas.map((f) => ({
        nombre: f.nombre,
        telefono: f.telefono,
        correo: f.correo,
        etapa: NOMBRE_DE_ETAPA[f.etapa as EtapaDeal],
        pendiente: f.pendiente ? NOMBRE_DE_PENDIENTE[f.pendiente] : null,
        dueno: f.duenoNombre ?? f.duenoCorreo,
        cohorte: f.cohorte,
        calidad: f.calidad,
        valor: f.valor,
        origen: [f.utmSource, f.utmMedium, f.utmCampaign].filter(Boolean).join(" / ") || null,
        creado: fechaHoraEnBogota(f.creado),
        linkCrm: new URL(`/p/${encodeURIComponent(programa.slug)}/deals/${f.dealId}`, url.origin).toString(),
      })),
    );

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="deals-${programa.slug}-${hoyEnBogota()}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
