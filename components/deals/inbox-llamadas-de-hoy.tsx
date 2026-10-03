"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetalleDeLlamada } from "@/components/deals/detalle-de-llamada";
import { fechaHoraEnBogota } from "@/lib/format";
import type { FilaLlamada } from "@/lib/queries/inbox";
import type { OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { Vacio } from "@/components/deals/ficha/campos";

/**
 * Sección 1 del Inbox (ticket 071; segunda pasada, ticket 176): "Llamadas que ya pasaron sin
 * resultado", el dolor número uno. Cada fila es una llamada de MI deal cuya cita ya pasó y
 * sigue `agendada`. La fila **abre el detalle**, donde viven el Link de Grain y el único
 * botón "Resultado" (`AccionesDeLlamada`): ya no hay botones sueltos. Al resolverla, el
 * detalle refresca y la fila desaparece de esta sección.
 *
 * Mobile first: los closers la usan en el teléfono a mitad de un bloque de llamadas.
 */
export function InboxLlamadasDeHoy({
  llamadas,
  slug,
  puedeRegistrar,
  motivosReagenda,
  origen,
}: {
  llamadas: FilaLlamada[];
  slug: string;
  /** Trabaja leads Y el deal es suyo (o administra). Proyección: la reja es el servidor. */
  puedeRegistrar: boolean;
  /** Motivos de re-agenda del programa, para el resultado "No se dio" desde Atendido. */
  motivosReagenda: OpcionesDeFicha["motivos"];
  /** El origen de la pantalla, para que "Ir al deal" del detalle vuelva aqui (ticket 174). */
  origen: string;
}) {
  const [detalleId, setDetalleId] = useState<string | null>(null);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Llamadas que ya pasaron sin resultado</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {llamadas.length === 0 ? (
          <Vacio>
            Ninguna llamada pendiente de resultado. Cuando pase la hora de una cita sin que la marques, aparece acá para
            que no se te pase.
          </Vacio>
        ) : (
          <ul className="divide-y">
            {llamadas.map((fila) => (
              <FilaDeHoy key={fila.callId} fila={fila} onAbrir={() => fila.callId && setDetalleId(fila.callId)} />
            ))}
          </ul>
        )}
      </CardContent>
      {detalleId ? (
        <DetalleDeLlamada
          programaSlug={slug}
          callId={detalleId}
          conIrAlDeal
          puedeRegistrar={puedeRegistrar}
          motivosReagenda={motivosReagenda}
          origen={origen}
          onCerrar={() => setDetalleId(null)}
        />
      ) : null}
    </Card>
  );
}

function FilaDeHoy({ fila, onAbrir }: { fila: FilaLlamada; onAbrir: () => void }) {
  const nombre = fila.leadNombre ?? fila.leadEmail ?? "Ver llamada";
  return (
    <li className="relative flex flex-col gap-2 px-4 py-3">
      <button
        type="button"
        className="block w-full min-w-0 space-y-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onAbrir}
      >
        <span className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-marca-texto">{nombre}</span>
          {fila.ownerNombre ? <Badge variant="neutro">{fila.ownerNombre}</Badge> : null}
        </span>
        {fila.leadEmail ? <span className="block truncate text-xs text-muted-foreground">{fila.leadEmail}</span> : null}
        <span className="cifra block text-xs text-muted-foreground">
          {fila.fechaAgenda ? `Cita ${fechaHoraEnBogota(fila.fechaAgenda)}` : "Sin fecha de cita"}
        </span>
      </button>
      {fila.linkCalendly ? (
        <a
          className="relative z-10 text-xs text-marca-texto underline-offset-2 hover:underline"
          href={fila.linkCalendly}
          target="_blank"
          rel="noreferrer"
        >
          Cita en Calendly
        </a>
      ) : null}
    </li>
  );
}
