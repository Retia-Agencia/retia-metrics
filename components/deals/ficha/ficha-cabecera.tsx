import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fecha, fechaHoraEnBogota } from "@/lib/format";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { FichaDeDeal } from "@/lib/queries/ficha-deal";
import type { TonoEtapa } from "../etapa-tono";
import { Dato } from "./campos";

/**
 * La cabecera de la ficha (ticket 074): quien es el lead, en que etapa esta el deal y sus
 * datos de un vistazo. Solo lectura. Si el deal esta anulado, lo dice arriba y con el motivo:
 * un deal anulado "se ve tachado, nunca con un tono" (§9), no como una etapa.
 */
export function FichaCabecera({
  ficha,
  nombreDeEtapa,
  tonoDeEtapa,
}: {
  ficha: FichaDeDeal;
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
}) {
  const { lead } = ficha;
  const anulado = ficha.anulado != null;

  return (
    <Card>
      <CardContent className="space-y-4">
        {ficha.anulado ? (
          <div className="rounded-lg bg-tono-peligro-suave p-3 text-sm text-tono-peligro">
            <p className="font-medium">Deal anulado: no cuenta en ninguna métrica.</p>
            <p>
              {fechaHoraEnBogota(ficha.anulado.en)} por {ficha.anulado.porNombre ?? "alguien"} · {ficha.anulado.motivo}
            </p>
          </div>
        ) : null}

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className={anulado ? "text-lg font-semibold line-through text-muted-foreground" : "text-lg font-semibold"}>
              {lead.nombre ?? lead.email}
            </h2>
            <p className="text-sm text-muted-foreground">{lead.nombre ? lead.email : null}</p>
          </div>
          <Badge variant={anulado ? "neutro" : tonoDeEtapa[ficha.etapa]}>
            {nombreDeEtapa[ficha.etapa]}
            {anulado ? " (anulado)" : ""}
          </Badge>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4">
          <Dato etiqueta="Dueño">{ficha.owner ? (ficha.owner.nombre ?? "Sin nombre") : "Sin dueño"}</Dato>
          <Dato etiqueta="Área de origen">{ficha.areaDeclarada?.nombre ?? null}</Dato>
          <Dato etiqueta="Cohorte">
            {ficha.cohorte?.codigo ?? null}
            {ficha.cohorteDestino ? ` → ${ficha.cohorteDestino.codigo}` : null}
          </Dato>
          <Dato etiqueta="Seguimiento">{ficha.fechaSeguimiento ? fecha(ficha.fechaSeguimiento) : null}</Dato>
          <Dato etiqueta="Teléfono">{lead.telefono}</Dato>
          <Dato etiqueta="Empresa">{[lead.empresa, lead.cargo].filter(Boolean).join(" · ") || null}</Dato>
          <Dato etiqueta="Ubicación">{[lead.ciudad, lead.pais].filter(Boolean).join(", ") || null}</Dato>
          <Dato etiqueta="Canal">
            {ficha.origen === null
              ? "Sin envío de origen"
              : ficha.origen.utmSource || ficha.origen.utmMedium
                ? `${ficha.origen.utmSource ?? "—"} / ${ficha.origen.utmMedium ?? "—"}`
                : "Sin UTM"}
          </Dato>
          {ficha.motivo ? <Dato etiqueta="Motivo del cierre">{ficha.motivo.nombre}</Dato> : null}
          <Dato etiqueta="Creado">{fechaHoraEnBogota(ficha.creadoEn)}</Dato>
        </dl>
      </CardContent>
    </Card>
  );
}
