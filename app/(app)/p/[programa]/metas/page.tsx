import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageShell } from "@/components/page-shell";
import { MetasDelMes } from "@/components/metas/metas-del-mes";
import { buttonVariants } from "@/components/ui/button";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { veTableroDelPrograma } from "@/lib/auth/roles";
import { hoyEnBogota } from "@/lib/format";
import type { PeriodoResuelto } from "@/lib/periodo";
import { leerMetasDelMes, moverMes, nombreDelMes } from "@/lib/queries/metas";
import { urlDeLista } from "@/lib/queries/vista-metrica";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const esquemaMes = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);

function periodo(rango: { desde: string; hasta: string }): PeriodoResuelto {
  return { preset: "custom", a: rango, b: null };
}

export default async function MetasDelProgramaPage({ params, searchParams }: Props) {
  // Las Metas caen con el Dashboard (ticket 224, ADR 0082): las ve quien ve el tablero
  // (gerente, developer, paid trafficker), nunca el closer, que recibe 404. Por capacidad
  // (`veTableroDelPrograma`), nunca `rol === "..."`.
  const session = await paginaConCapacidad(veTableroDelPrograma);

  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();

  const hoy = hoyEnBogota();
  const busqueda = await searchParams;
  const valorMes = typeof busqueda.mes === "string" ? busqueda.mes : undefined;
  const mes = esquemaMes.catch(hoy.slice(0, 7)).parse(valorMes);
  const metas = await leerMetasDelMes(programa.id, mes, hoy);
  const anterior = moverMes(mes, -1);
  const siguiente = moverMes(mes, 1);
  const hrefVentasMes = urlDeLista(slug, "cierres", periodo(metas.periodoMes));
  const hrefVentasSemana = metas.compensacionSemanal
    ? urlDeLista(slug, "cierres", periodo({ desde: metas.compensacionSemanal.desde, hasta: metas.compensacionSemanal.hasta }))
    : null;

  return (
    <PageShell
      titulo="Metas"
      descripcion={`Meta comercial de ${nombreDelMes(mes)}`}
      acciones={
        <nav aria-label="Cambiar mes" className="flex items-center gap-2">
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href={`?mes=${anterior}`}>← {nombreDelMes(anterior)}</Link>
          <Link className={cn(buttonVariants({ variant: "ghost", size: "sm" }))} href={`?mes=${siguiente}`}>{nombreDelMes(siguiente)} →</Link>
        </nav>
      }
    >
      <MetasDelMes metas={metas} hrefVentasMes={hrefVentasMes} hrefVentasSemana={hrefVentasSemana} />
    </PageShell>
  );
}
