import { Enlace } from "@/components/enlace";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programaDeTabOConfigurar } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { NOMBRE_DE_ETAPA } from "@/lib/deals/etapas";
import { fechaHoraEnBogota } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, ZonaConScroll } from "@/components/layout/pantalla-fija";
import { Button } from "@/components/ui/button";
import { ProximaCohorteCards } from "@/components/deals/proxima-cohorte-cards";
import { TONO_DE_ETAPA } from "@/components/deals/etapa-tono";
import { cargarDatosDeProximaCohorte } from "@/lib/proxima-cohorte/cargar-datos";

export const dynamic = "force-dynamic";

export default async function ProximaCohortePage({ params, searchParams }: {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await paginaConRol("gerente", "closer");
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const programa = await programaDeTabOConfigurar(session.user.id, rol, slug);
  const busqueda = await searchParams;
  const { vista, deals, cohortes } = await cargarDatosDeProximaCohorte(db, { programId: programa.id, busqueda });
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
            <Button variant={vista === "sin_asignar" ? "secondary" : "ghost"} nativeButton={false} render={<Enlace precarga="nunca" href="?vista=sin_asignar" />}>Sin cohorte asignada</Button>
            <Button variant={vista === "asignada" ? "secondary" : "ghost"} nativeButton={false} render={<Enlace precarga="nunca" href="?vista=asignada" />}>Con cohorte asignada</Button>
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
