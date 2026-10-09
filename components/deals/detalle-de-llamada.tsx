"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { detalleDeLlamadaAccion } from "@/app/(app)/p/[programa]/calls/acciones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  cambioLegible,
  etiquetaDeOrigen,
  ETIQUETA_DE_RESULTADO,
  TONO_DE_RESULTADO,
} from "@/lib/deals/estado-de-llamada";
import { fechaHoraEnBogota } from "@/lib/format";
import { enlaceConVuelta } from "@/lib/navegacion/volver";
import type { DetalleDeLlamada as Detalle } from "@/lib/queries/detalle-llamada";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { AccionesDeLlamada } from "@/components/deals/ficha/acciones-de-llamada";

export function DetalleDeLlamada({
  programaSlug,
  callId,
  onCerrar,
  esActiva = false,
  conIrAlDeal = false,
  puedeRegistrar = false,
  motivosReagenda = [],
  origen,
}: {
  programaSlug: string;
  callId: string;
  onCerrar: () => void;
  esActiva?: boolean;
  conIrAlDeal?: boolean;
  /** Si se puede registrar sobre esta llamada: muestra el Grain y el botón "Resultado" (ticket 176). */
  puedeRegistrar?: boolean;
  motivosReagenda?: OpcionesDeFicha["motivos"];
  /** El origen de la pantalla, para que "Ir al deal" vuelva aqui (ticket 174). */
  origen?: string;
}) {
  const [detalle, setDetalle] = useState<Detalle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    void detalleDeLlamadaAccion({ programaSlug, callId }).then((resultado) => {
      if (!vigente) return;
      if (resultado.ok) setDetalle(resultado.detalle);
      else setError(resultado.error);
    });
    return () => { vigente = false; };
  }, [callId, programaSlug]);

  // Solo una cita abierta (no anulada) acepta un resultado o un Grain nuevo.
  const puedeActuar = puedeRegistrar && detalle != null && detalle.anuladoEn == null && detalle.dealId != null;

  return (
    <Dialog open onOpenChange={(abierto) => { if (!abierto) onCerrar(); }}>
      <DialogContent className="max-h-[85vh] min-w-0 overflow-x-hidden overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de la llamada</DialogTitle>
          <DialogDescription>La cita, sus responsables y los cambios registrados.</DialogDescription>
        </DialogHeader>

        {!detalle && !error ? <p className="text-sm text-muted-foreground">Cargando detalle…</p> : null}
        {error ? <p className="text-sm text-tono-peligro">{error}</p> : null}
        {detalle ? <Contenido detalle={detalle} esActiva={esActiva} /> : null}

        {puedeActuar ? (
          <div className="border-t pt-4">
            <AccionesDeLlamada
              callId={callId}
              dealId={detalle!.dealId}
              linkGrain={detalle!.linkGrain}
              resultado={detalle!.resultado}
              motivosReagenda={motivosReagenda}
            />
          </div>
        ) : null}

        <DialogFooter>
          {detalle?.dealId && conIrAlDeal ? (
            <Button nativeButton={false} render={<Link href={enlaceConVuelta(`/p/${programaSlug}/deals/${detalle.dealId}`, origen ?? "")} />}>
              Ir al deal
            </Button>
          ) : null}
          <Button variant="outline" onClick={onCerrar}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Contenido({ detalle, esActiva }: { detalle: Detalle; esActiva: boolean }) {
  const correoLead = detalle.lead?.email ?? detalle.emailLead;
  const historialLegible = detalle.historial.flatMap((cambio) => {
    const legible = cambioLegible(cambio, detalle.nombresDelHistorial);
    return legible ? [{ ...cambio, legible }] : [];
  });
  return (
    <div className="min-w-0 space-y-4 text-sm">
      <div className="flex flex-wrap gap-2">
        <Badge variant={TONO_DE_RESULTADO[detalle.resultado]}>
          {ETIQUETA_DE_RESULTADO[detalle.resultado]}
        </Badge>
        {esActiva ? <Badge variant="default">Cita activa</Badge> : null}
        {detalle.anuladoEn ? <Badge variant="peligro">Anulada</Badge> : null}
      </div>

      <dl className="grid min-w-0 gap-3">
        <Dato etiqueta="Lead">
          {detalle.lead?.nombre ?? correoLead ?? "Sin lead"}
          {correoLead ? <span className="block break-all text-xs text-muted-foreground">{correoLead}</span> : null}
        </Dato>
        <Dato etiqueta="Cita"><Fecha valor={detalle.fechaAgenda} vacio="Sin fecha de cita" /></Dato>
        <Dato etiqueta="Ocurrió"><Fecha valor={detalle.fechaLlamada} vacio="Todavía no registrada" /></Dato>
        {detalle.fechaSeguimiento ? <Dato etiqueta="Seguimiento"><Fecha valor={detalle.fechaSeguimiento} /></Dato> : null}
        <Dato etiqueta="Closer">
          {detalle.closer?.nombre ?? "Sin closer"}
          {detalle.closer?.email ? <span className="block break-all text-xs text-muted-foreground">{detalle.closer.email}</span> : null}
        </Dato>
        <Dato etiqueta="Setter">{detalle.setter?.nombre ?? "Sin setter"}</Dato>
        <Dato etiqueta="Origen">{etiquetaDeOrigen(detalle.origen)}</Dato>
        {detalle.calendlyHostEmail ? <Dato etiqueta="Host de Calendly"><span className="break-all">{detalle.calendlyHostEmail}</span></Dato> : null}
        {detalle.motivo ? <Dato etiqueta="Motivo">{detalle.motivo.nombre}</Dato> : null}
        <Dato etiqueta="Creada"><Fecha valor={detalle.createdAt} /></Dato>
      </dl>

      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {detalle.linkCalendly ? (
          <a className="text-marca-texto underline-offset-2 hover:underline" href={detalle.linkCalendly} target="_blank" rel="noreferrer">
            Link de la cita
          </a>
        ) : null}
        {detalle.linkGrain ? (
          <a className="text-marca-texto underline-offset-2 hover:underline" href={detalle.linkGrain} target="_blank" rel="noreferrer">Grain</a>
        ) : null}
      </div>

      {detalle.notas ? <Seccion titulo="Notas"><p className="whitespace-pre-wrap break-words text-muted-foreground">{detalle.notas}</p></Seccion> : null}

      {detalle.anuladoEn ? (
        <Seccion titulo="Anulación">
          <p className="text-muted-foreground">
            <span className="cifra">{fechaHoraEnBogota(detalle.anuladoEn)}</span>
            {detalle.anuladoPorNombre ? ` · ${detalle.anuladoPorNombre}` : ""}
          </p>
          <p className="break-words">{detalle.motivoAnulacion}</p>
        </Seccion>
      ) : null}

      {!detalle.dealId ? (
        <p className="rounded-lg bg-muted p-3 text-muted-foreground">
          Llamada suelta: se asigna desde la lista de sueltas.
        </p>
      ) : null}

      <Seccion titulo="Historial">
        {historialLegible.length === 0 ? (
          <p className="text-muted-foreground">Sin cambios registrados</p>
        ) : (
          <ul className="divide-y">
            {historialLegible.map((cambio, indice) => (
              <li key={`${cambio.detectadoEn.toString()}-${cambio.campo}-${indice}`} className="min-w-0 py-2 first:pt-0 last:pb-0">
                <p className="break-words">
                  <span className="font-medium">{cambio.legible.etiqueta}:</span>{" "}
                  {cambio.legible.anterior ?? "—"} → {cambio.legible.nuevo ?? "—"}
                </p>
                <p className="cifra text-xs text-muted-foreground">
                  {fechaHoraEnBogota(cambio.detectadoEn)} · {cambio.userNombre ?? "Sistema"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  );
}

function Fecha({ valor, vacio = "—" }: { valor: Date | string | null; vacio?: string }) {
  return <span className="cifra">{valor ? fechaHoraEnBogota(valor) : vacio}</span>;
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-muted-foreground">{etiqueta}</dt><dd className="min-w-0 break-words">{children}</dd></div>;
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return <section className="min-w-0 space-y-2"><h3 className="font-medium">{titulo}</h3>{children}</section>;
}
