import { notFound } from "next/navigation";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { programasVisibles } from "@/lib/auth/alcance";
import { rolDeVista } from "@/lib/auth/vista";
import { veEquipoComercial, veTableroDelPrograma } from "@/lib/auth/roles";
import { fechaHoraEnBogota, hoyEnBogota } from "@/lib/format";
import { armarReporteDiario, resolverDiaDelReporte } from "@/lib/queries/reporte-diario";
import { sinListas } from "@/lib/queries/vista-metrica";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { GuardarComoPdf } from "@/components/hub-reporte/guardar-como-pdf";
import { ReporteDeTodosLosProgramas } from "@/components/hub-reporte/reporte";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ReporteDelHubPage({ searchParams }: Props) {
  const session = await paginaConCapacidad(veTableroDelPrograma);
  const rol = await rolDeVista(session);
  const programas = await programasVisibles(session.user.id, rol);
  if (programas.length === 0) notFound();

  const busqueda = await searchParams;
  const hoy = hoyEnBogota();
  const diaPedido = resolverDiaDelReporte(typeof busqueda.fecha === "string" ? busqueda.fecha : undefined, hoy);
  const dia = diaPedido ?? hoy;
  const puedeVerEquipo = veEquipoComercial(rol);
  const reportes = await Promise.all(programas.map(async (programa) => {
    const reporte = await armarReporteDiario({ programId: programa.id, dia });
    return { programa, reporte: puedeVerEquipo ? reporte : sinListas(reporte) };
  }));
  const generado = fechaHoraEnBogota(new Date());

  return (
    <PageShell titulo="Reporte diario" descripcion="Todos los programas visibles, en un documento listo para guardar como PDF">
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 print:hidden">
          <form action="/hub/reporte" className="flex flex-wrap items-end gap-2">
            <label className="grid gap-1 text-xs font-medium text-muted-foreground">
              Día del reporte
              <input
                type="date"
                name="fecha"
                defaultValue={dia}
                max={hoy}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
            </label>
            <Button type="submit" variant="outline">Ver día</Button>
          </form>
          <GuardarComoPdf generado={generado} />
        </div>
        {diaPedido === null ? (
          <p role="alert" className="rounded-lg border border-tono-peligro/40 px-3 py-2 text-sm text-tono-peligro">
            Esa fecha no es válida (no puede ser futura): se muestra hoy.
          </p>
        ) : null}
        <ReporteDeTodosLosProgramas reportes={reportes} dia={dia} generado={generado} veEquipo={puedeVerEquipo} />
      </div>
    </PageShell>
  );
}
