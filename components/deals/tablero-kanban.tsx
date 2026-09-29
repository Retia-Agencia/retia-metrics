"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { EtapaDeal } from "@/lib/deals/etapas";
import type { ColumnaKanban, OpcionCatalogo, TarjetaDeal } from "@/lib/queries/kanban";
import type { FlechaCliente, MapaTransiciones } from "./transiciones";
import { flechaPideDatos, sePuedeArrastrar } from "./transiciones";
import type { TonoEtapa } from "./etapa-tono";
import { TarjetaDealCard } from "./tarjeta-deal";
import { DialogoMover, type DatosDialogo } from "./dialogo-mover";
import { moverDeal } from "@/app/(app)/p/[programa]/deals/acciones";

/**
 * El tablero Kanban (ticket 069): columnas por etapa y tarjetas de deal, con arrastre
 * HTML5 nativo (sin dependencia nueva) y un menú "Mover a…" para celular y teclado.
 *
 * - **Todo movimiento pasa por la server action `moverDeal`**, que llama `moverEtapa()`:
 *   la reja de verdad está en el servidor. El cliente solo decide el resaltado del
 *   arrastre con el mapa de transiciones que el SERVIDOR le pasó como props (no importa
 *   drizzle: `transiciones.ts` es datos planos).
 * - **Optimista:** al soltar, la tarjeta salta a la nueva columna; si el servidor
 *   rechaza, vuelve a su sitio y se muestran los `faltantes` (qué falta), nunca un
 *   genérico "no se puede" (ticket 044).
 * - **Las flechas que pide datos** (producto, fechas, cohorte, motivo) abren un diálogo;
 *   lo recogido va en la MISMA acción (una transacción).
 * - **Las columnas hacen scroll horizontal**; la página no se desplaza de lado en
 *   celular. `prefers-reduced-motion` se respeta en las tarjetas.
 */

export interface TableroKanbanProps {
  columnas: ColumnaKanban[];
  total: number;
  mapa: MapaTransiciones;
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
  programaSlug: string;
  productos: (OpcionCatalogo & { moneda: string; precio: string })[];
  cohortes: OpcionCatalogo[];
  motivos: { id: string; nombre: string; tipo: string }[];
}

/** Lo que un movimiento pendiente necesita saber para abrir su diálogo. */
interface MovimientoPendiente {
  tarjeta: TarjetaDeal;
  flecha: FlechaCliente;
}

export function TableroKanban({
  columnas,
  total,
  mapa,
  nombreDeEtapa,
  tonoDeEtapa,
  programaSlug,
  productos,
  cohortes,
  motivos,
}: TableroKanbanProps) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();

  // Movimiento OPTIMISTA: qué deal se muestra en qué etapa mientras el servidor responde.
  const [movidoOptimista, setMovidoOptimista] = useState<Record<string, EtapaDeal>>({});
  // La tarjeta que se está arrastrando (para el efecto "levantar") y la columna sobre la
  // que se está soltando (para el resaltado).
  const [arrastrando, setArrastrando] = useState<TarjetaDeal | null>(null);
  const [columnaHover, setColumnaHover] = useState<EtapaDeal | null>(null);
  const [dialogo, setDialogo] = useState<MovimientoPendiente | null>(null);

  // La etapa efectiva de una tarjeta: la optimista si la hay, o la real.
  const etapaDe = (t: TarjetaDeal): EtapaDeal => movidoOptimista[t.dealId] ?? t.etapa;

  function ejecutar(tarjeta: TarjetaDeal, flecha: FlechaCliente, datos: DatosDialogo) {
    const etapaOriginal = tarjeta.etapa;
    setMovidoOptimista((prev) => ({ ...prev, [tarjeta.dealId]: flecha.a }));
    iniciar(async () => {
      const r = await moverDeal({
        dealId: tarjeta.dealId,
        a: flecha.a,
        motivoId: datos.motivoId ?? null,
        datos: {
          productoId: datos.productoId,
          fechaLimitePago: datos.fechaLimitePago,
          cohorteDestinoId: datos.cohorteDestinoId,
          fechaSeguimiento: datos.fechaSeguimiento,
        },
      });
      if (r.ok) {
        toast.success(`Movido a ${nombreDeEtapa[flecha.a]}.`);
        setDialogo(null);
        // El servidor ya escribió: se refresca la pantalla actual (router.refresh),
        // NO revalidatePath, que no refresca la ruta que acaba de escribir (AGENTS.md).
        router.refresh();
        // Se limpia la marca optimista tras el refresh: los datos nuevos ya reflejan el
        // movimiento y dejarla haría un doble estado.
        setMovidoOptimista((prev) => {
          const copia = { ...prev };
          delete copia[tarjeta.dealId];
          return copia;
        });
      } else {
        // Rechazo: la tarjeta vuelve a su columna y se dice QUÉ falta (los faltantes),
        // no un genérico. La base no se movió (lo garantiza el motor).
        setMovidoOptimista((prev) => {
          const copia = { ...prev };
          copia[tarjeta.dealId] = etapaOriginal;
          delete copia[tarjeta.dealId];
          return copia;
        });
        const detalle = r.faltantes.length > 0 ? r.faltantes.map((f) => f.mensaje).join(" ") : r.error;
        toast.error(detalle, { duration: 6000 });
      }
    });
  }

  /** Elegir un destino: si la flecha pide datos, abre el diálogo; si no, mueve directo. */
  function elegirDestino(tarjeta: TarjetaDeal, flecha: FlechaCliente) {
    if (flechaPideDatos(flecha)) {
      setDialogo({ tarjeta, flecha });
    } else {
      ejecutar(tarjeta, flecha, {});
    }
  }

  function soltarEn(etapaDestino: EtapaDeal) {
    const tarjeta = arrastrando;
    setArrastrando(null);
    setColumnaHover(null);
    if (!tarjeta) return;
    const de = etapaDe(tarjeta);
    if (de === etapaDestino) return;
    const flecha = mapa.find((f) => f.de === de && f.a === etapaDestino);
    if (!flecha || flecha.quien === "sistema") {
      toast.error(
        flecha
          ? "Ese paso lo pone el sistema cuando pasa el hecho; no se arrastra a mano."
          : `No se puede pasar de ${nombreDeEtapa[de]} a ${nombreDeEtapa[etapaDestino]}.`,
      );
      return;
    }
    elegirDestino(tarjeta, flecha);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        {total} {total === 1 ? "deal" : "deals"}
      </p>

      {/* Scroll horizontal en el tablero; la página nunca se desplaza de lado. */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {columnas.map((columna) => {
          const destinoPermitido =
            arrastrando != null && sePuedeArrastrar(mapa, etapaDe(arrastrando), columna.etapa);
          const destinoProhibido =
            arrastrando != null &&
            etapaDe(arrastrando) !== columna.etapa &&
            !sePuedeArrastrar(mapa, etapaDe(arrastrando), columna.etapa);

          // Las tarjetas de esta columna según la etapa efectiva (optimista incluida).
          const tarjetas = columnas
            .flatMap((c) => c.tarjetas)
            .filter((t) => etapaDe(t) === columna.etapa);

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
                "flex w-72 shrink-0 flex-col rounded-xl bg-background/60 p-2 transition-colors duration-150 motion-reduce:transition-none",
                columnaHover === columna.etapa && destinoPermitido && "ring-2 ring-primary",
                columnaHover === columna.etapa && destinoProhibido && "cursor-not-allowed opacity-60 ring-2 ring-border",
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
                      mapa={mapa}
                      nombreDeEtapa={nombreDeEtapa}
                      programaSlug={programaSlug}
                      arrastrando={arrastrando?.dealId === tarjeta.dealId}
                      onArrastrarInicio={() => setArrastrando(tarjeta)}
                      onArrastrarFin={() => {
                        setArrastrando(null);
                        setColumnaHover(null);
                      }}
                      onElegirDestino={(flecha) => elegirDestino(tarjeta, flecha)}
                    />
                  ))
                )}
              </div>
            </section>
          );
        })}
      </div>

      {dialogo ? (
        <DialogoMover
          abierto={dialogo != null}
          onAbrir={(v) => {
            if (!v) setDialogo(null);
          }}
          flecha={dialogo.flecha}
          etapaDestinoNombre={nombreDeEtapa[dialogo.flecha.a]}
          nombreLead={dialogo.tarjeta.nombreLead ?? dialogo.tarjeta.emailLead}
          productos={productos}
          cohortes={cohortes}
          motivos={motivos}
          pendiente={pendiente}
          onConfirmar={(datos) => ejecutar(dialogo.tarjeta, dialogo.flecha, datos)}
        />
      ) : null}
    </div>
  );
}
