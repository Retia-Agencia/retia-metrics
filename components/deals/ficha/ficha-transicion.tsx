"use client";

import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { fecha } from "@/lib/format";
import type { FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { respuestasPorDestino } from "../pregunta-de-etapa";
import { BotonesDeRespuesta, useResponder, type DealQueResponde } from "../responder-pregunta";
import type { MapaTransiciones } from "../transiciones";
import type { TonoEtapa } from "../etapa-tono";

export function FichaTransicion({
  ficha,
  opciones,
  mapa,
  ordenDeEtapas,
  nombreDeEtapa,
  tonoDeEtapa,
  rutaDeLaFicha,
  puedeTrabajar,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  mapa: MapaTransiciones;
  ordenDeEtapas: readonly EtapaDeal[];
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
  rutaDeLaFicha: string;
  puedeTrabajar: boolean;
}) {
  const router = useRouter();
  const { elegir, abrirDestino, dialogo } = useResponder(mapa, opciones, nombreDeEtapa, () => router.refresh());
  const deal: DealQueResponde = {
    dealId: ficha.dealId,
    etapa: ficha.etapa,
    pendiente: ficha.pendiente,
    nombreLead: ficha.lead.nombre ?? ficha.lead.email,
    rutaDeLaFicha,
    fechaLimiteSugerida: ficha.fechaLimiteSugerida,
    linkAgenda: ficha.linkAgenda,
    tieneCitaVigente: ficha.tieneCitaVigente,
  };
  const grupos = respuestasPorDestino(ficha.etapa, ficha.pendiente, ordenDeEtapas);
  if (!puedeTrabajar || ficha.anulado || (grupos.destinos.length === 0 && grupos.sinCambio.length === 0)) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Transición</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {grupos.destinos.map((grupo) => {
            const etapaVisual = grupo.destino === "ganado" ? "ganado_completo" : grupo.destino;
            const etiqueta = grupo.destino === "ganado" ? "Ganado · registrar pago" : nombreDeEtapa[grupo.destino];
            return (
              <Button key={grupo.destino} type="button" size="sm" variant="outline" onClick={() => abrirDestino(deal, grupo.destino, grupo.respuestas)}>
                <Badge variant={tonoDeEtapa[etapaVisual]}>{etiqueta}</Badge>
              </Button>
            );
          })}
        </div>
        {grupos.sinCambio.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Sin cambiar de etapa</h3>
            <BotonesDeRespuesta respuestas={grupos.sinCambio} onElegir={(respuesta) => elegir(deal, respuesta)} />
          </section>
        ) : null}
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
