import { alcanceDeDeals } from "@/lib/auth/alcance-deals";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { requireRole, respuestaDeError } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { fechaHoraEnBogota, hoyEnBogota } from "@/lib/format";
import { csvDeGrain } from "@/lib/llamadas/csv-grain";
import { filtroDeLlamadasDesdeUrl, llamadasDelPrograma, RESULTADOS } from "@/lib/queries/llamadas";
import { tieneGrain } from "@/lib/queries/sin-grain";
import { nombreDeEtapa } from "@/lib/queries/vista-metrica";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ programa: string }> },
) {
  try {
    const session = await requireRole("gerente", "closer");
    const { programa: slug } = await params;
    const rol = await rolDeVista(session);
    const programa = esRolValido(rol)
      ? await programaVisiblePorSlug(session.user.id, rol, slug, db)
      : null;
    if (!programa) throw new ErrorDeApp("No encontrado.", 404);

    const alcance = await alcanceDeDeals(session);
    const url = new URL(request.url);
    const filtro = await filtroDeLlamadasDesdeUrl(db, programa.id, alcance, url.searchParams);
    const llamadas = (await llamadasDelPrograma(db, programa.id, alcance, filtro)).filter((fila) =>
      tieneGrain(fila.linkGrain),
    );
    const origen = url.origin;
    const etiquetasResultado = new Map<string, string>(RESULTADOS);
    const csv = csvDeGrain(
      llamadas.map((fila) => ({
        fechaLlamada:
          fila.fechaLlamada || fila.fechaAgenda
            ? fechaHoraEnBogota(fila.fechaLlamada ?? fila.fechaAgenda!)
            : null,
        lead: fila.leadNombre,
        correo: fila.leadEmail,
        closer: fila.closerNombre ?? fila.closerEmail,
        resultado: etiquetasResultado.get(fila.resultado) ?? fila.resultado,
        etapaDeal: fila.etapa ? nombreDeEtapa(fila.etapa) : null,
        linkGrain: fila.linkGrain,
        linkCrm: fila.dealId
          ? new URL(`/p/${encodeURIComponent(programa.slug)}/deals/${fila.dealId}`, origen).toString()
          : null,
      })),
    );

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="grain-${programa.slug}-${hoyEnBogota()}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return respuestaDeError(error);
  }
}
