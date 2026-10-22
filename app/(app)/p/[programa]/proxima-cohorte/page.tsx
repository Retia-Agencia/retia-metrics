import Link from "next/link";
import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { dealsDeProximaCohorte, vistaProximaCohorte } from "@/lib/queries/proxima-cohorte";
import { fechaHoraEnBogota } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, ZonaConScroll } from "@/components/layout/pantalla-fija";
import { Button } from "@/components/ui/button";
import { ProximaCohorteCards } from "@/components/deals/proxima-cohorte-cards";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";

export const dynamic = "force-dynamic";

export default async function ProximaCohortePage({ params, searchParams }: {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaVisiblePorSlug(session.user.id, rol, slug);
  if (!programa) notFound();
  const busqueda = await searchParams;
  const vista = vistaProximaCohorte(busqueda.vista);
  const [deals, cohortes] = await Promise.all([
    dealsDeProximaCohorte(db, programa.id, vista),
    listarCohortes(db, programa.id),
  ]);
  const cards = deals.map((deal) => ({
    dealId: deal.dealId,
    nombreLead: deal.nombreLead ?? "Lead sin nombre",
    cohorteOrigen: deal.cohorteOrigenCodigo ?? "Sin cohorte",
    etapaNombre: NOMBRE_DE_ETAPA[deal.etapa],
    etapaTono: TONO_DE_ETAPA[deal.etapa],
    destino: deal.cohorteDestinoCodigo ?? deal.cohorteDestinoTexto ?? "Sin cohorte asignada",
    ownerNombre: deal.ownerNombre ?? "Sin dueño",
    esperaDesde: fechaHoraEnBogota(deal.esperaDesde),
  }));

  return (
    <PageShell titulo={programa.nombre} descripcion="Próxima cohorte" fija>
      <PantallaFija>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button variant={vista === "sin_asignar" ? "secondary" : "ghost"} nativeButton={false} render={<Link href="?vista=sin_asignar" />}>Sin cohorte asignada</Button>
            <Button variant={vista === "asignada" ? "secondary" : "ghost"} nativeButton={false} render={<Link href="?vista=asignada" />}>Con cohorte asignada</Button>
          </div>
          <span className="text-sm text-muted-foreground"><span className="cifra">{cards.length}</span> deals</span>
        </div>
        <ZonaConScroll className="space-y-3">
          <ProximaCohorteCards
            cards={cards}
            cohortes={cohortes.filter((c) => c.estado !== "cerrado").map((c) => ({ id: c.id, codigo: c.codigo }))}
            programId={programa.id}
            programaSlug={programa.slug}
            permiteSeleccionar={vista === "sin_asignar"}
          />
        </ZonaConScroll>
      </PantallaFija>
    </PageShell>
  );
}
