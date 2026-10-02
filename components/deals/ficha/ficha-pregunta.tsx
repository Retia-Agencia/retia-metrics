"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { fecha } from "@/lib/format";
import type { FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { PREGUNTA_DE_ETAPA, respuestasDe } from "../pregunta-de-etapa";
import { BotonesDeRespuesta, useResponder, type DealQueResponde } from "../responder-pregunta";
import type { MapaTransiciones } from "../transiciones";

/**
 * La pregunta de la etapa en la ficha (ADR 0072 punto 1): su respuesta es la flecha.
 * Reemplaza el menú de "mover de etapa"; la ficha no tiene otro camino para cambiarla.
 * Una flecha abre el dialogo con lo que pide y lo que el deal tiene y le falta; una
 * actividad, una llamada o un abono abren su formulario en esta misma ficha.
 */
export function FichaPregunta({
  ficha,
  opciones,
  mapa,
  nombreDeEtapa,
  rutaDeLaFicha,
  puedeTrabajar,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  mapa: MapaTransiciones;
  nombreDeEtapa: Record<EtapaDeal, string>;
  /** `/p/<programa>/deals/<id>`: donde viven los formularios que abre una respuesta. */
  rutaDeLaFicha: string;
  /** Su dueño o quien administra. Proyeccion: la reja es el servidor. */
  puedeTrabajar: boolean;
}) {
  const router = useRouter();
  const { elegir, dialogo } = useResponder(mapa, opciones, nombreDeEtapa, () => router.refresh());
  const deal: DealQueResponde = {
    dealId: ficha.dealId,
    etapa: ficha.etapa,
    pendiente: ficha.pendiente,
    nombreLead: ficha.lead.nombre ?? ficha.lead.email,
    rutaDeLaFicha,
    fechaLimiteSugerida: ficha.fechaLimiteSugerida,
  };

  const respuestas = respuestasDe(ficha.etapa, ficha.pendiente);
  if (!puedeTrabajar || ficha.anulado || respuestas.length === 0) return null;
  const { pregunta } = PREGUNTA_DE_ETAPA[ficha.etapa];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{pregunta ?? "Siguiente paso"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <BotonesDeRespuesta respuestas={respuestas} onElegir={(r) => elegir(deal, r)} />
        {ficha.pendiente === "proxima_cohorte" && ficha.cohorteDestino?.inicioVentas ? (
          <p className="text-xs text-muted-foreground">
            Se retoma solo cuando se registre un contacto desde el {fecha(ficha.cohorteDestino.inicioVentas)}.
          </p>
        ) : null}
      </CardContent>
      {dialogo}
    </Card>
  );
}
