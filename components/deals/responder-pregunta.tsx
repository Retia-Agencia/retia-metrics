"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import type { OpcionCatalogo } from "@/lib/queries/kanban";
import { moverDeal } from "@/app/(app)/p/[programa]/deals/acciones";
import { DialogoMover, type DatosDialogo, type MovimientoDelDialogo } from "./dialogo-mover";
import { accionDeFicha, enlaceDeAccion } from "./ficha/accion-pedida";
import { PREGUNTA_DE_ETAPA, type Respuesta } from "./pregunta-de-etapa";
import type { FlechaCliente, MapaTransiciones } from "./transiciones";

/**
 * Responder la pregunta de la etapa (ADR 0072 puntos 1 y 2). Lo usan la ficha, el Kanban
 * al soltar y la lista de llamadas del programa, así que una respuesta hace lo mismo
 * desde donde se tome:
 *
 * - una flecha (`mover`, `retroceder`) abre `DialogoMover`, que pide sus datos y muestra lo
 *   que el deal tiene y le falta, y confirma con `moverDeal`;
 * - una actividad, una llamada o un abono abren su formulario de siempre en la ficha
 *   (`?accion=…`): no hay un segundo camino para registrar nada.
 */
export interface DealQueResponde {
  dealId: string;
  etapa: EtapaDeal;
  pendiente: PendienteDeal | null;
  nombreLead: string;
  /** `/p/<programa>/deals/<id>`: donde viven los formularios. */
  rutaDeLaFicha: string;
  fechaLimiteSugerida?: string | null;
}

export interface OpcionesDeRespuesta {
  areas: OpcionCatalogo[];
  cohortes: OpcionCatalogo[];
  motivos: { id: string; nombre: string; tipo: string }[];
}

/** La flecha del mapa que toma una respuesta, para saber qué datos pide. */
function flechaDe(mapa: MapaTransiciones, deal: DealQueResponde, r: Respuesta): FlechaCliente | null {
  const a = r.accion;
  if (a.tipo === "retroceder") return mapa.find((f) => f.tipo === "etapa" && f.id === "RETRO" && f.de === deal.etapa) ?? null;
  if (a.tipo !== "mover") return null;
  if (a.a !== deal.etapa) return mapa.find((f) => f.tipo === "etapa" && f.de === deal.etapa && f.a === a.a) ?? null;
  return mapa.find((f) => f.tipo === "pendiente" && f.de === deal.etapa && f.pendienteA === a.pendiente) ?? null;
}

/**
 * `elegir(deal, respuesta)` y el dialogo que hay que montar. El deal va en cada llamada
 * porque el Kanban usa una sola instancia para todas sus tarjetas. `alTerminar` corre
 * despues de un movimiento confirmado (refrescar, cerrar lo que haya abierto).
 */
export function useResponder(
  mapa: MapaTransiciones,
  opciones: OpcionesDeRespuesta,
  nombreDeEtapa: Record<EtapaDeal, string>,
  alTerminar: () => void,
): { elegir: (deal: DealQueResponde, r: Respuesta) => void; dialogo: ReactNode } {
  const router = useRouter();
  const [abierta, setAbierta] = useState<{ deal: DealQueResponde; respuesta: Respuesta; flecha: FlechaCliente } | null>(null);
  const [enviando, setEnviando] = useState(false);

  function elegir(deal: DealQueResponde, r: Respuesta) {
    const formulario = accionDeFicha(r.accion);
    if (formulario) {
      router.push(enlaceDeAccion(deal.rutaDeLaFicha, formulario));
      return;
    }
    const flecha = flechaDe(mapa, deal, r);
    if (!flecha) {
      toast.error(`Desde ${nombreDeEtapa[deal.etapa]} no se puede: ${r.etiqueta}.`);
      return;
    }
    setAbierta({ deal, respuesta: r, flecha });
  }

  async function confirmar(deal: DealQueResponde, datos: DatosDialogo, destino: EtapaDeal, pendiente: PendienteDeal | null) {
    setEnviando(true);
    const r = await moverDeal({
      dealId: deal.dealId,
      a: destino,
      pendiente,
      motivoId: datos.motivoId ?? null,
      datos: {
        descuentoUsd: datos.descuentoUsd,
        areaDeclaradaId: datos.areaDeclaradaId,
        fechaLimitePago: datos.fechaLimitePago,
        cohorteDestinoId: datos.cohorteDestinoId,
        fechaSeguimiento: datos.fechaSeguimiento,
      },
    });
    setEnviando(false);
    if (r.ok) {
      toast.success(destino === deal.etapa ? "Guardado." : `Movido a ${nombreDeEtapa[destino]}.`);
      setAbierta(null);
      alTerminar();
    } else {
      // Se dice QUE falta, no un generico (ticket 044).
      toast.error(r.faltantes.length > 0 ? r.faltantes.map((f) => f.mensaje).join(" ") : r.error, { duration: 6000 });
    }
  }

  let dialogo: ReactNode = null;
  if (abierta) {
    const { deal } = abierta;
    const accion = abierta.respuesta.accion;
    const movimiento: MovimientoDelDialogo =
      accion.tipo === "retroceder"
        ? { dealId: deal.dealId, a: "retroceso", pendiente: null }
        : { dealId: deal.dealId, a: accion.tipo === "mover" ? accion.a : deal.etapa, pendiente: accion.tipo === "mover" ? accion.pendiente : null };
    dialogo = (
      <DialogoMover
        abierto
        onAbrir={(v) => !v && setAbierta(null)}
        flecha={abierta.flecha}
        // Fuera de la ficha ("Sí" a secas no dice nada en el Kanban) va con su pregunta.
        titulo={[PREGUNTA_DE_ETAPA[deal.etapa].pregunta, abierta.respuesta.etiqueta].filter(Boolean).join(" · ")}
        rutaDeLaFicha={deal.rutaDeLaFicha}
        nombreLead={deal.nombreLead}
        movimiento={movimiento}
        nombreDeEtapa={nombreDeEtapa}
        areas={opciones.areas}
        cohortes={opciones.cohortes}
        motivos={opciones.motivos}
        fechaLimiteSugerida={deal.fechaLimiteSugerida ?? null}
        enviando={enviando}
        onConfirmar={(datos, destino) => void confirmar(deal, datos, destino, movimiento.pendiente)}
      />
    );
  }
  return { elegir, dialogo };
}

/** Los botones de las respuestas, en el orden de la tabla. */
export function BotonesDeRespuesta({
  respuestas,
  onElegir,
  deshabilitado = false,
}: {
  respuestas: readonly Respuesta[];
  onElegir: (r: Respuesta) => void;
  deshabilitado?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {respuestas.map((r) => (
        <Button
          key={r.id}
          type="button"
          size="sm"
          variant={r.id === "descartar" ? "outline" : "secondary"}
          disabled={deshabilitado}
          onClick={() => onElegir(r)}
        >
          {r.etiqueta}
        </Button>
      ))}
    </div>
  );
}
