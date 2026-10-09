"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fecha, fechaDeInstanteEnBogota, hoyEnBogota } from "@/lib/format";
import type { DuenoPosible } from "@/lib/deals/duenos";
import type { FilaSinDueno } from "@/lib/queries/inbox-sin-dueno";
import {
  completarAgendadaAccion,
  reasignarDealAccion,
  reclamarDealAccion,
  reclamarTodosPorSettearAccion,
  type ResultadoInbox,
} from "@/app/(app)/p/[programa]/inbox/acciones";
import { Campo, claseInput, DialogoForm, Vacio } from "@/components/deals/ficha/campos";

/**
 * Las dos secciones "sin dueño" del Inbox (ticket 070): Por settear y Agendados sin
 * dueño. El origen (UTM tal como llegó, y quién lo trajo cuando exista) va a la vista para
 * que el closer decida si reclama (ADR 0044 punto 5).
 *
 * `puedeReclamar` (trabaja leads) y `administra` (reasigna) son PROYECCIÓN: la reja de
 * verdad vive en las server actions. Al reclamar un Agendado con cita por completar, se
 * ofrece completar la llamada (reusa `completarAgendada`), que exige ya ser el dueño.
 *
 * Funciona a 390px: las filas apilan su info y los botones envuelven.
 */

/** Corre una server action del Inbox: avisa el resultado y refresca la pantalla si escribió. */
function useAccionInbox() {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  function correr<T extends object>(
    accion: () => Promise<ResultadoInbox<T>>,
    opciones: { exito: string | ((r: { ok: true } & T) => string); alExito?: (r: { ok: true } & T) => void },
  ) {
    iniciar(async () => {
      const r = await accion();
      if (r.ok) {
        toast.success(typeof opciones.exito === "function" ? opciones.exito(r) : opciones.exito);
        opciones.alExito?.(r);
        router.refresh();
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    });
  }

  return { pendiente, correr };
}

function Origen({ fila }: { fila: FilaSinDueno }) {
  const { utmSource, utmMedium, utmCampaign, traidoPorNombre } = fila.origen;
  const sinUtm = utmSource === null && utmMedium === null && utmCampaign === null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {sinUtm ? (
        <Badge variant="neutro">Sin UTM</Badge>
      ) : (
        <span className="cifra">
          {utmSource ?? "—"} / {utmMedium ?? "—"} / {utmCampaign ?? "—"}
        </span>
      )}
      {traidoPorNombre ? <span>Traído por {traidoPorNombre}</span> : null}
    </div>
  );
}

function FilaInfo({ fila }: { fila: FilaSinDueno }) {
  return (
    <div className="min-w-0 space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="truncate text-sm font-medium">{fila.leadNombre ?? fila.leadEmail}</span>
        {fila.puntaje === null ? (
          <Badge variant="neutro">Sin score</Badge>
        ) : (
          <Badge variant="info">
            Score <span className="cifra ml-1">{fila.puntaje}</span>
          </Badge>
        )}
      </div>
      <p className="truncate text-xs text-muted-foreground">{fila.leadEmail}</p>
      {fila.fechaUltimaAplicacion ? (
        <p className="cifra text-xs text-muted-foreground">
          Último envío {fecha(fechaDeInstanteEnBogota(fila.fechaUltimaAplicacion))}
        </p>
      ) : null}
      <Origen fila={fila} />
    </div>
  );
}

function BotonReclamar({
  dealId,
  onReclamado,
}: {
  dealId: string;
  onReclamado?: () => void;
}) {
  const { pendiente, correr } = useAccionInbox();
  return (
    <Button
      size="sm"
      variant="default"
      disabled={pendiente}
      onClick={() =>
        correr(() => reclamarDealAccion({ dealId }), {
          exito: "Reclamado: quedó a tu nombre.",
          alExito: () => onReclamado?.(),
        })
      }
    >
      {pendiente ? "Reclamando…" : "Reclamar"}
    </Button>
  );
}

function Reasignar({ dealId, duenos }: { dealId: string; duenos: DuenoPosible[] }) {
  const { pendiente, correr } = useAccionInbox();
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const items = duenos.map((d) => ({ value: d.id, label: d.nombre }));
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={ownerUserId}
        items={items}
        onValueChange={(v: string | null) => setOwnerUserId(v)}
      >
        <SelectTrigger className="w-48" size="sm">
          <SelectValue placeholder="Asignar a…" />
        </SelectTrigger>
        <SelectContent>
          {duenos.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        size="sm"
        variant="outline"
        disabled={pendiente || !ownerUserId}
        onClick={() =>
          ownerUserId &&
          correr(() => reasignarDealAccion({ dealId, ownerUserId }), {
            exito: "Reasignado.",
            alExito: () => setOwnerUserId(null),
          })
        }
      >
        {pendiente ? "Guardando…" : "Reasignar"}
      </Button>
    </div>
  );
}

/** El diálogo para completar la cita, tras reclamar un Agendado (reusa `completarAgendada`). */
function DialogoCompletar({ callId, onCerrar }: { callId: string; onCerrar: () => void }) {
  const { pendiente, correr } = useAccionInbox();
  const [dia, setDia] = useState(hoyEnBogota());
  const [hora, setHora] = useState("");
  const [link, setLink] = useState("");
  return (
    <DialogoForm
      titulo="Completar la cita agendada"
      descripcion="Ya reclamaste el deal. El sistema dejó la cita sin fecha: complétala para que quede a tu nombre."
      pendiente={pendiente}
      onCerrar={onCerrar}
      deshabilitarConfirmar={!dia || !hora}
      confirmar={{
        texto: "Completar",
        enCurso: "Guardando…",
        onClick: () =>
          correr(() => completarAgendadaAccion({ callId, dia, hora, linkCalendly: link }), {
            exito: "Cita completada.",
            alExito: onCerrar,
          }),
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Día de la cita" ayuda="Hora de Bogotá.">
          <input type="date" className={claseInput} value={dia} onChange={(e) => setDia(e.target.value)} />
        </Campo>
        <Campo etiqueta="Hora">
          <input type="time" className={claseInput} value={hora} onChange={(e) => setHora(e.target.value)} />
        </Campo>
      </div>
      <Campo etiqueta="Link de Calendly (opcional)">
        <input
          type="url"
          className={claseInput}
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://calendly.com/…"
        />
      </Campo>
    </DialogoForm>
  );
}

/** La fila de un Agendado: reclamar y, tras reclamar, ofrecer completar la cita. */
function FilaAgendado({
  fila,
  puedeReclamar,
  administra,
  duenos,
}: {
  fila: FilaSinDueno;
  puedeReclamar: boolean;
  administra: boolean;
  duenos: DuenoPosible[];
}) {
  // Tras reclamar, si hay cita por completar, se abre el diálogo. Estado local: el reclamo
  // ya escribió y refrescó; el diálogo es el segundo paso opcional (ticket 057).
  const [completar, setCompletar] = useState(false);
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <FilaInfo fila={fila} />
      <div className="flex flex-wrap items-center gap-2">
        {puedeReclamar ? (
          <BotonReclamar
            dealId={fila.dealId}
            onReclamado={() => {
              if (fila.llamadaPorCompletarId) setCompletar(true);
            }}
          />
        ) : null}
        {administra ? <Reasignar dealId={fila.dealId} duenos={duenos} /> : null}
      </div>
      {completar && fila.llamadaPorCompletarId ? (
        <DialogoCompletar callId={fila.llamadaPorCompletarId} onCerrar={() => setCompletar(false)} />
      ) : null}
    </li>
  );
}

/** La fila de Por settear: reclamar (y reasignar si administra). Sin cita. */
function FilaSetteo({
  fila,
  puedeReclamar,
  administra,
  duenos,
}: {
  fila: FilaSinDueno;
  puedeReclamar: boolean;
  administra: boolean;
  duenos: DuenoPosible[];
}) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
      <FilaInfo fila={fila} />
      <div className="flex flex-wrap items-center gap-2">
        {puedeReclamar ? <BotonReclamar dealId={fila.dealId} /> : null}
        {administra ? <Reasignar dealId={fila.dealId} duenos={duenos} /> : null}
      </div>
    </li>
  );
}

type PropsSeccionSinDueno = {
  filas: FilaSinDueno[];
  puedeReclamar: boolean;
  administra: boolean;
  duenos: DuenoPosible[];
};

export function InboxAgendadosSinDueno({
  filas,
  puedeReclamar,
  administra,
  duenos,
}: PropsSeccionSinDueno) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Agendados sin dueño</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {filas.length === 0 ? (
          <Vacio>No hay Agendados esperando dueño. Cuando una cita entre sin closer, aparece acá.</Vacio>
        ) : (
          <ul className="divide-y">
            {filas.map((fila) => (
              <FilaAgendado
                key={fila.dealId}
                fila={fila}
                puedeReclamar={puedeReclamar}
                administra={administra}
                duenos={duenos}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function InboxPorSettear({
  filas,
  puedeReclamar,
  administra,
  duenos,
  programId,
}: PropsSeccionSinDueno & { programId: string }) {
  const { pendiente, correr } = useAccionInbox();
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle>Por settear</CardTitle>
        {puedeReclamar && filas.length > 0 ? (
          <Button
            size="sm"
            disabled={pendiente}
            onClick={() => correr(() => reclamarTodosPorSettearAccion({ programId }), {
              exito: ({ reclamados, saltados }) =>
                `Te asignaste ${reclamados} deals.${saltados > 0 ? ` ${saltados} ya tenían dueño.` : ""}`,
            })}
          >
            {pendiente ? "Asignando…" : "Asignarme todos"}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {filas.length === 0 ? (
          <Vacio>No hay leads en cola para settear. Cuando entre uno nuevo, aparece acá, priorizado por score.</Vacio>
        ) : (
          <ul className="divide-y">
            {filas.map((fila) => (
              <FilaSetteo
                key={fila.dealId}
                fila={fila}
                puedeReclamar={puedeReclamar}
                administra={administra}
                duenos={duenos}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export function InboxSinDueno({
  pendienteSetteo,
  unclaimed,
  puedeReclamar,
  administra,
  duenos,
  programId,
}: {
  pendienteSetteo: FilaSinDueno[];
  unclaimed: FilaSinDueno[];
  /** Trabaja leads: ve el botón Reclamar (la reja es el servidor). */
  puedeReclamar: boolean;
  /** Administra: ve el select de Reasignar. */
  administra: boolean;
  /** Los dueños posibles del programa, para el select de reasignar. */
  duenos: DuenoPosible[];
  programId: string;
}) {
  return (
    <div className="space-y-4">
      <InboxAgendadosSinDueno filas={unclaimed} puedeReclamar={puedeReclamar} administra={administra} duenos={duenos} />
      <InboxPorSettear filas={pendienteSetteo} puedeReclamar={puedeReclamar} administra={administra} duenos={duenos} programId={programId} />
    </div>
  );
}
