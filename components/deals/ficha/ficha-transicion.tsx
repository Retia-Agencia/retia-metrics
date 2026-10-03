"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { fecha } from "@/lib/format";
import type { FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { BotonDeEtapa } from "../boton-de-etapa";
import { respuestasPorDestino } from "../pregunta-de-etapa";
import { useResponder, type DealQueResponde } from "../responder-pregunta";
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
  const { elegir, registrar, abrirDestino, dialogo } = useResponder(mapa, opciones, nombreDeEtapa, () => router.refresh());
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
  const etiquetasDestino = grupos.destinos.map((grupo) =>
    grupo.destino === "ganado" ? "Ganado · registrar pago" : nombreDeEtapa[grupo.destino],
  );
  const anchoCh = etiquetasDestino.length > 0 ? Math.max(...etiquetasDestino.map((etiqueta) => etiqueta.length)) : 0;
  const respuestasSinCambio = grupos.sinCambio.filter((respuesta) => respuesta.accion.tipo !== "actividad");
  if (!puedeTrabajar || ficha.anulado) return null;

  return (
    <Card>
      <CardHeader><CardTitle>Transición</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {grupos.destinos.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Mover a</h3>
            <div className="flex flex-wrap gap-2">
              {grupos.destinos.map((grupo, i) => {
                const etapaVisual = grupo.destino === "ganado" ? "ganado_completo" : grupo.destino;
                return (
                  <BotonDeEtapa
                    key={grupo.destino}
                    tono={tonoDeEtapa[etapaVisual]}
                    anchoCh={anchoCh}
                    onClick={() => abrirDestino(deal, grupo.destino, grupo.respuestas)}
                  >
                    {etiquetasDestino[i]}
                  </BotonDeEtapa>
                );
              })}
            </div>
          </section>
        ) : null}
        <section className="space-y-2">
          <h3 className="text-sm font-medium">Registrar</h3>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={() => registrar(deal, "contacto")}>
              Contacto
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => registrar(deal, "intento")}>
              Intento
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => registrar(deal, "nota")}>
              Nota
            </Button>
            {respuestasSinCambio.map((respuesta) => (
              <Button
                key={respuesta.id}
                type="button"
                size="sm"
                variant={respuesta.id === "descartar" ? "outline" : "secondary"}
                onClick={() => elegir(deal, respuesta)}
              >
                {respuesta.etiqueta}
              </Button>
            ))}
          </div>
        </section>
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
