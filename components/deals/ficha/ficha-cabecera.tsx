import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { fecha, fechaHoraEnBogota, saldoLegible, usd, pct } from "@/lib/format";
import { NOMBRE_DE_PENDIENTE, type EtapaDeal } from "@/lib/deals/etapas";
import type { FichaDeDeal } from "@/lib/queries/ficha-deal";
import { enlaceConVuelta } from "@/lib/navegacion/volver";
import { TONO_DE_PENDIENTE, type TonoEtapa } from "../etapa-tono";
import { Dato } from "./campos";

/**
 * La cabecera de la ficha (ticket 074): quien es el lead, en que etapa esta el deal y sus
 * datos de un vistazo. Solo lectura. Si el deal esta anulado, lo dice arriba y con el motivo:
 * un deal anulado "se ve tachado, nunca con un tono" (§9), no como una etapa.
 */
export function FichaCabecera({
  ficha,
  nombre,
  programaSlug,
  origen,
  nombreDeEtapa,
  tonoDeEtapa,
}: {
  ficha: FichaDeDeal;
  nombre: string;
  programaSlug: string;
  /** La ruta de ESTA ficha (con su propio `desde`), para que el lead vuelva un paso (ticket 174). */
  origen: string;
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
}) {
  const anulado = ficha.anulado != null;
  const saldo = saldoLegible(ficha.saldo.saldo, ficha.saldo.moneda ?? "USD", ficha.saldo.sinSaldoPorque);

  return (
    <Card id="campos" className="scroll-mt-24">
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
            <h2 className={anulado ? "break-words text-lg font-semibold line-through text-muted-foreground" : "break-words text-lg font-semibold"}>
              {nombre}
            </h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Badge variant={anulado ? "neutro" : tonoDeEtapa[ficha.etapa]}>
              {nombreDeEtapa[ficha.etapa]}
              {anulado ? " (anulado)" : ""}
            </Badge>
            {ficha.pendiente ? (
              <Badge variant={TONO_DE_PENDIENTE[ficha.pendiente]}>{NOMBRE_DE_PENDIENTE[ficha.pendiente]}</Badge>
            ) : null}
          </div>
        </div>

        {ficha.lead.envios >= 2 ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{ficha.lead.envios} envíos</Badge>
            <Link
              href={enlaceConVuelta(`/p/${programaSlug}/leads/${ficha.lead.id}`, origen)}
              className="text-sm text-muted-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver los envíos
            </Link>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-5">
          <Dato etiqueta="Dueño">{ficha.owner ? (ficha.owner.nombre ?? "Sin nombre") : "Sin dueño"}</Dato>
          {ficha.setter ? <Dato etiqueta="Setteado por">{ficha.setter.nombre ?? "Sin nombre"}</Dato> : null}
          {ficha.handoffEn ? <Dato etiqueta="Link enviado el">{fechaHoraEnBogota(ficha.handoffEn)}</Dato> : null}
          <Dato etiqueta="Valor vendido">
            <span className="cifra">{ficha.valorVendidoUsd == null ? "—" : usd(ficha.valorVendidoUsd)}</span>
          </Dato>
          <Dato etiqueta="Ticket base">
            <span className="cifra">{ficha.ticket ? usd(ficha.ticket.precioUsd) : "—"}</span>
          </Dato>
          <Dato etiqueta="Descuento">
            <span className="cifra">{ficha.descuento ? `${usd(ficha.descuento.usd)} · ${pct(ficha.descuento.porcentaje)}` : "—"}</span>
          </Dato>
          <Dato etiqueta={saldo.etiqueta}>
            <span className={saldo.esCifra ? "cifra" : undefined}>{saldo.valor}</span>
          </Dato>
          {ficha.cohorteDestino ? <Dato etiqueta="Cambia a cohorte">{ficha.cohorteDestino.codigo}</Dato> : null}
          {ficha.pendiente === "seguimiento" ? (
            <Dato etiqueta="Próximo contacto">{ficha.fechaSeguimiento ? fecha(ficha.fechaSeguimiento) : null}</Dato>
          ) : null}
          {/* Solo en Cierre perdido (A-33): un deal recuperado ya no está cerrado; el motivo queda en el log. */}
          {ficha.motivo && ficha.etapa === "cierre_perdido" ? <Dato etiqueta="Motivo del cierre">{ficha.motivo.nombre}</Dato> : null}
          <Dato etiqueta="Creado">{fechaHoraEnBogota(ficha.creadoEn)}</Dato>
        </dl>
      </CardContent>
    </Card>
  );
}
