"use client";

import type { PendienteDeal } from "@/lib/deals/etapas";
import type { TarjetaDeal } from "@/lib/queries/kanban";
import { TarjetaDealCard } from "@/components/deals/tarjeta-deal";

/**
 * La cuadrícula de tarjetas de un chip de Notificaciones (ticket 222). Son las MISMAS
 * `TarjetaDealCard` de Deals, tal cual, pero fuera del Kanban: aquí no se arrastran ni se
 * mueven (eso vive en el tablero), así que `puedeMover` es false —oculta el asa y el menú— y
 * los manejadores son no-ops. Tocar una tarjeta abre la ficha por el enlace interno de la
 * tarjeta, que ya lleva la vuelta (`enlaceConVuelta`) para que Volver regrese a este chip y página.
 *
 * Una columna a 390 px y hasta tres en pantallas anchas (sistema "Tinta": sin colores,
 * sombras ni radios a mano).
 */
export function TarjetasNotificacion({
  tarjetas,
  nombreDePendiente,
  programaSlug,
  origen,
}: {
  tarjetas: TarjetaDeal[];
  nombreDePendiente: Record<PendienteDeal, string>;
  programaSlug: string;
  origen: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {tarjetas.map((tarjeta) => (
        <TarjetaDealCard
          key={tarjeta.dealId}
          tarjeta={tarjeta}
          nombreDePendiente={nombreDePendiente}
          programaSlug={programaSlug}
          origen={origen}
          arrastrando={false}
          puedeMover={false}
          onArrastrarInicio={noop}
          onArrastrarFin={noop}
          onElegirRespuesta={noop}
        />
      ))}
    </div>
  );
}

function noop() {}
