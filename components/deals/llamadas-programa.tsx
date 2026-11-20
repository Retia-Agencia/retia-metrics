"use client";

import { Enlace } from "@/components/enlace";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetalleDeLlamada } from "@/components/deals/detalle-de-llamada";
import { Card, CardContent } from "@/components/ui/card";
import { fechaHoraEnBogota, num } from "@/lib/format";
import { ETIQUETA_DE_RESULTADO, TONO_DE_RESULTADO } from "@/lib/deals/estado-de-llamada";
import type { FilaLlamadaPrograma } from "@/lib/queries/llamadas";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { marcarConfirmacionMasivaAccion } from "@/app/(app)/p/[programa]/calls/acciones";
import { useAccion } from "@/components/deals/ficha/uso-accion";

/**
 * Las llamadas del programa (ticket 074; segunda pasada, ticket 176): la fila abre el
 * **detalle**, donde viven el Link de Grain y el único botón "Resultado"
 * (`AccionesDeLlamada`). Ya no hay botones sueltos en la fila.
 */
export function LlamadasPrograma({
  llamadas,
  programaSlug,
  motivosReagenda,
  puedeTrabajar,
  origen,
  paginacion,
}: {
  llamadas: FilaLlamadaPrograma[];
  programaSlug: string;
  motivosReagenda: OpcionesDeFicha["motivos"];
  puedeTrabajar: boolean;
  /** El origen de la pantalla, para que "Ir al deal" del detalle vuelva aqui (ticket 174). */
  origen: string;
  /**
   * Calls pagina de a 50 en el servidor (ticket 185). Los enlaces llegan ya armados: una función
   * no cruza la frontera servidor → cliente (el mismo molde de `PosiblesDuplicados`).
   */
  paginacion: { pagina: number; paginas: number; anteriorHref: string | null; siguienteHref: string | null };
}) {
  const [detalleId, setDetalleId] = useState<string | null>(null);
  const [seleccionadas, setSeleccionadas] = useState<Set<string>>(() => new Set());
  const { pendiente, correr } = useAccion();

  const alternar = (callId: string) => setSeleccionadas((actuales) => {
    const siguientes = new Set(actuales);
    if (siguientes.has(callId)) siguientes.delete(callId);
    else siguientes.add(callId);
    return siguientes;
  });

  const marcarSeleccionadas = () => correr(
    () => marcarConfirmacionMasivaAccion({ programaSlug, callIds: [...seleccionadas] }),
    {
      exito: ({ marcadas, omitidas }) => `${marcadas} confirmadas${omitidas ? ` · ${omitidas} omitidas` : ""}.`,
      alExito: () => setSeleccionadas(new Set()),
    },
  );

  return (
    <Card className="flex min-h-0 flex-1 flex-col">
      {/* El conteo "Llamadas · N" lo da ahora la línea de estado de la barra de lista
          (ticket 202); aquí la tarjeta solo es la lista con su scroll. */}
      {seleccionadas.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2 text-xs">
          <span><span className="cifra">{num(seleccionadas.size)}</span> seleccionadas</span>
          <Button size="xs" variant="outline" disabled={pendiente} onClick={marcarSeleccionadas}>Marcar confirmadas</Button>
          <Button size="xs" variant="ghost" disabled={pendiente} onClick={() => setSeleccionadas(new Set())}>Limpiar</Button>
        </div>
      ) : null}
      <CardContent className={clasesDeZonaConScroll("p-0")}>
        {llamadas.length === 0 ? (
          <ul className="divide-y">
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              No hay llamadas que coincidan con los filtros.
            </li>
          </ul>
        ) : (
          <ul className="divide-y">
            {llamadas.map((llamada) => (
              <FilaLlamada
                key={llamada.callId}
                llamada={llamada}
                puedeSeleccionar={puedeTrabajar && llamada.resultado === "agendada"}
                seleccionada={seleccionadas.has(llamada.callId)}
                onSeleccionar={() => alternar(llamada.callId)}
                onAbrir={() => setDetalleId(llamada.callId)}
              />
            ))}
          </ul>
        )}
      </CardContent>
      {paginacion.paginas > 1 ? (
        <nav className="flex shrink-0 items-center justify-between px-4 text-sm" aria-label="Páginas">
          {paginacion.anteriorHref ? (
            <Enlace precarga="nunca" href={paginacion.anteriorHref} className="text-marca-texto underline-offset-2 hover:underline">
              Anterior
            </Enlace>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted-foreground">
            Página <span className="cifra">{num(paginacion.pagina + 1)}</span> de <span className="cifra">{num(paginacion.paginas)}</span>
          </span>
          {paginacion.siguienteHref ? (
            <Enlace precarga="nunca" href={paginacion.siguienteHref} className="text-marca-texto underline-offset-2 hover:underline">
              Siguiente
            </Enlace>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
      {detalleId ? (
        <DetalleDeLlamada
          programaSlug={programaSlug}
          callId={detalleId}
          conIrAlDeal
          puedeRegistrar={puedeTrabajar}
          motivosReagenda={motivosReagenda}
          origen={origen}
          onCerrar={() => setDetalleId(null)}
        />
      ) : null}
    </Card>
  );
}

function FilaLlamada({
  llamada,
  puedeSeleccionar,
  seleccionada,
  onSeleccionar,
  onAbrir,
}: {
  llamada: FilaLlamadaPrograma;
  puedeSeleccionar: boolean;
  seleccionada: boolean;
  onSeleccionar: () => void;
  onAbrir: () => void;
}) {
  const nombre = llamada.leadNombre ?? llamada.leadEmail ?? "Llamada sin lead";
  return (
    <li className="relative flex cursor-pointer flex-col gap-2 px-4 py-3 hover:bg-muted/50 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-2">
        {puedeSeleccionar ? (
          <input
            type="checkbox"
            className="relative z-10 mt-0.5 size-4 shrink-0 accent-primary"
            aria-label={`Seleccionar llamada de ${nombre}`}
            checked={seleccionada}
            onChange={onSeleccionar}
            onClick={(evento) => evento.stopPropagation()}
          />
        ) : null}
        <div className="min-w-0 flex-1 space-y-1">
          <button type="button" className="block w-full min-w-0 space-y-1 rounded-md text-left after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onAbrir}>
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm font-medium text-marca-texto">{nombre}</span>
            <Badge variant={TONO_DE_RESULTADO[llamada.resultado]}>{ETIQUETA_DE_RESULTADO[llamada.resultado]}</Badge>
            {llamada.confirmacion === "confirmada" ? <Badge variant="neutro">Confirmó</Badge> : null}
            {llamada.closerNombre ? <Badge variant="neutro">{llamada.closerNombre}</Badge> : null}
          </span>
          {llamada.leadEmail ? <span className="block truncate text-xs text-muted-foreground">{llamada.leadEmail}</span> : null}
          <span className="cifra block text-xs text-muted-foreground">
            {llamada.fechaAgenda ? `Cita ${fechaHoraEnBogota(llamada.fechaAgenda)}` : llamada.fechaLlamada ? `Ocurrió ${fechaHoraEnBogota(llamada.fechaLlamada)}` : "Sin fecha"}
          </span>
          </button>
          <div className="relative z-10 flex flex-wrap gap-x-4 text-xs">
            {llamada.linkCalendly ? <a className="text-marca-texto underline-offset-2 hover:underline" href={llamada.linkCalendly} target="_blank" rel="noreferrer">Cita en Calendly</a> : null}
            {llamada.linkGrain ? <a className="text-marca-texto underline-offset-2 hover:underline" href={llamada.linkGrain} target="_blank" rel="noreferrer">Grabación</a> : null}
          </div>
          {llamada.notas ? <p className="whitespace-pre-wrap text-sm text-muted-foreground">{llamada.notas}</p> : null}
        </div>
      </div>
    </li>
  );
}
