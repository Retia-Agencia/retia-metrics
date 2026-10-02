"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import type { ColumnaKanban, OpcionCatalogo, TarjetaDeal } from "@/lib/queries/kanban";
import type { MapaTransiciones } from "./transiciones";
import type { TonoEtapa } from "./etapa-tono";
import { TarjetaDealCard } from "./tarjeta-deal";
import { respuestasHacia } from "./pregunta-de-etapa";
import { useResponder, type DealQueResponde } from "./responder-pregunta";

/**
 * El tablero Kanban (ticket 069): columnas por etapa y tarjetas de deal, con arrastre
 * HTML5 nativo (sin dependencia nueva) y, en cada tarjeta, la pregunta de su etapa para
 * celular y teclado.
 *
 * - **Soltar abre la pregunta de la etapa** (ADR 0072 punto 2): con la respuesta que lleva
 *   a esa columna ya elegida (o a escoger, si hay varias), su dialogo pide los datos y
 *   muestra lo que el deal tiene y le falta. Si ninguna respuesta lleva ahí, la tarjeta no
 *   se mueve y se dice por qué. Soltar en una columna de ganado abre el abono en la ficha:
 *   a ganado solo se entra con plata (ADR 0037).
 * - **Todo movimiento pasa por la server action `moverDeal`**, que llama `moverEtapa()`:
 *   la reja de verdad está en el servidor. El cliente solo decide el resaltado del
 *   arrastre con la tabla de preguntas (`pregunta-de-etapa.ts`, datos planos).
 * - **Las columnas hacen scroll horizontal**; la página no se desplaza de lado en
 *   celular. `prefers-reduced-motion` se respeta en las tarjetas.
 */

export interface TableroKanbanProps {
  columnas: ColumnaKanban[];
  total: number;
  mapa: MapaTransiciones;
  nombreDeEtapa: Record<EtapaDeal, string>;
  nombreDePendiente: Record<PendienteDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
  programaSlug: string;
  areas: OpcionCatalogo[];
  cohortes: OpcionCatalogo[];
  motivos: { id: string; nombre: string; tipo: string }[];
  /** Inicio de clases por cohorte y el de la activa: prellenan la fecha limite de Compromiso Verbal. */
  inicioDeClases: Record<string, string>;
  inicioDeLaCohorteActiva: string | null;
  /** Quien mira, para saber que deals son suyos. Sale de la sesion en el servidor. */
  userId: string;
  /** Administra (gerente o developer, `esAdministrador`): mueve cualquier deal. */
  administra: boolean;
}

export function TableroKanban({
  columnas,
  total,
  mapa,
  nombreDeEtapa,
  nombreDePendiente,
  tonoDeEtapa,
  programaSlug,
  areas,
  cohortes,
  motivos,
  inicioDeClases,
  inicioDeLaCohorteActiva,
  userId,
  administra,
}: TableroKanbanProps) {
  const router = useRouter();
  // La tarjeta que se está arrastrando (para el efecto "levantar") y la columna sobre la
  // que se está soltando (para el resaltado).
  const [arrastrando, setArrastrando] = useState<TarjetaDeal | null>(null);
  const [columnaHover, setColumnaHover] = useState<EtapaDeal | null>(null);
  // El servidor ya escribió: se refresca la pantalla actual (router.refresh), NO
  // revalidatePath, que no refresca la ruta que acaba de escribir (AGENTS.md).
  const { elegir, abrirDestino, dialogo } = useResponder(mapa, { areas, cohortes, motivos }, nombreDeEtapa, () => router.refresh());

  function dealDe(t: TarjetaDeal): DealQueResponde {
    return {
      dealId: t.dealId,
      etapa: t.etapa,
      pendiente: t.pendiente,
      nombreLead: t.nombreLead ?? t.emailLead,
      rutaDeLaFicha: `/p/${programaSlug}/deals/${t.dealId}`,
      // La cohorte del deal; sin ella, la activa del programa (la que se le asignara al pagar).
      fechaLimiteSugerida: t.cohortId ? (inicioDeClases[t.cohortId] ?? null) : inicioDeLaCohorteActiva,
    };
  }

  function soltarEn(columna: EtapaDeal) {
    const tarjeta = arrastrando;
    setArrastrando(null);
    setColumnaHover(null);
    if (!tarjeta || tarjeta.etapa === columna) return;
    const respuestas = respuestasHacia(tarjeta.etapa, tarjeta.pendiente, columna);
    if (respuestas.length === 0) {
      toast.error(`Desde ${nombreDeEtapa[tarjeta.etapa]} no se pasa a ${nombreDeEtapa[columna]}.`);
      return;
    }
    abrirDestino(dealDe(tarjeta), columna, respuestas);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "deal" : "deals"}
      </p>

      {/* Scroll horizontal en el tablero; la página nunca se desplaza de lado. */}
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-4 sm:snap-none">
        {columnas.map((columna) => {
          const destinoPermitido =
            arrastrando != null && respuestasHacia(arrastrando.etapa, arrastrando.pendiente, columna.etapa).length > 0;
          const destinoProhibido = arrastrando != null && arrastrando.etapa !== columna.etapa && !destinoPermitido;
          const tarjetas = columna.tarjetas;

          return (
            <section
              key={columna.etapa}
              onDragOver={(e) => {
                if (arrastrando) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = destinoPermitido ? "move" : "none";
                  setColumnaHover(columna.etapa);
                }
              }}
              onDragLeave={() => setColumnaHover((c) => (c === columna.etapa ? null : c))}
              onDrop={(e) => {
                e.preventDefault();
                soltarEn(columna.etapa);
              }}
              className={cn(
                "flex w-[85vw] shrink-0 snap-start flex-col rounded-xl sm:w-72 bg-background/60 p-2 transition-colors duration-150 motion-reduce:transition-none",
                // Como en HubSpot: al levantar una tarjeta reacciona TODO el tablero, no solo
                // la columna bajo el cursor. Las validas se marcan, las prohibidas se apagan,
                // y la que tiene el cursor encima se destaca.
                destinoPermitido && "ring-1 ring-primary/40",
                destinoPermitido && columnaHover === columna.etapa && "bg-primary/10 ring-2 ring-primary",
                destinoProhibido && "opacity-40",
                destinoProhibido && columnaHover === columna.etapa && "cursor-not-allowed",
              )}
              aria-label={nombreDeEtapa[columna.etapa]}
            >
              <div className="flex items-center justify-between px-1 py-1.5">
                <Badge variant={tonoDeEtapa[columna.etapa]}>{nombreDeEtapa[columna.etapa]}</Badge>
                <span className="cifra text-xs text-muted-foreground">{tarjetas.length}</span>
              </div>

              {destinoProhibido && columnaHover === columna.etapa ? (
                <p className="px-1 pb-1 text-xs text-muted-foreground">Aquí no se puede soltar</p>
              ) : null}

              <div className="flex flex-1 flex-col gap-2 p-1">
                {tarjetas.length === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">
                    Sin deals en esta etapa.
                  </p>
                ) : (
                  tarjetas.map((tarjeta) => (
                    <TarjetaDealCard
                      key={tarjeta.dealId}
                      tarjeta={tarjeta}
                      nombreDePendiente={nombreDePendiente}
                      programaSlug={programaSlug}
                      arrastrando={arrastrando?.dealId === tarjeta.dealId}
                      puedeMover={administra || tarjeta.ownerUserId === userId}
                      onArrastrarInicio={() => setArrastrando(tarjeta)}
                      onArrastrarFin={() => {
                        setArrastrando(null);
                        setColumnaHover(null);
                      }}
                      onElegirRespuesta={(r) => elegir(dealDe(tarjeta), r)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {dialogo}
    </div>
  );
}
