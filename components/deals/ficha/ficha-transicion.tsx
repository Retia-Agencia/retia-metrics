"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { fecha } from "@/lib/format";
import type { AlertasDelDeal, FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { BotonDeEtapa } from "../boton-de-etapa";
import { gruposDeTransicion, queHace } from "../pregunta-de-etapa";
import { useResponder, type DealQueResponde } from "../responder-pregunta";
import type { MapaTransiciones } from "../transiciones";
import type { TonoEtapa } from "../etapa-tono";

export function FichaTransicion({
  ficha,
  opciones,
  mapa,
  ordenDeEtapas,
  nombreDeEtapa,
  nombreDePendiente,
  tonoDeEtapa,
  rutaDeLaFicha,
  puedeTrabajar,
  alertas,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  mapa: MapaTransiciones;
  ordenDeEtapas: readonly EtapaDeal[];
  nombreDeEtapa: Record<EtapaDeal, string>;
  nombreDePendiente: Record<PendienteDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
  rutaDeLaFicha: string;
  puedeTrabajar: boolean;
  alertas: AlertasDelDeal | null;
}) {
  const router = useRouter();
  const { elegir, registrarActividad, abrirDestino, dialogo } = useResponder(mapa, opciones, nombreDeEtapa, () => router.refresh());
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
  const { moverA, enEspera, actividades } = gruposDeTransicion(ficha.etapa, ficha.pendiente, ordenDeEtapas);
  const etiquetasDestino = moverA.map((grupo) =>
    grupo.destino === "ganado" ? "Ganado · registrar pago" : nombreDeEtapa[grupo.destino],
  );
  const anchoCh = etiquetasDestino.length > 0 ? Math.max(...etiquetasDestino.map((etiqueta) => etiqueta.length)) : 0;
  // El camino principal lo decide el servidor (alertas.paraAvanzar): es su destino.
  const destinoFeliz = alertas?.paraAvanzar.find((d) => d.caminoFeliz)?.destino ?? null;
  if (ficha.anulado) return null;

  return (
    <Card className="border-l-4 border-tono-exito">
      <CardHeader><CardTitle className="flex items-center gap-2">Transición <Badge variant="exito">Siguiente paso</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {alertas?.propiedades.length ? (
          <p className="text-sm text-tono-peligro">
            {alertas.propiedades.map((falta) => falta.mensaje).join(" ")}
          </p>
        ) : null}
        {alertas?.aviso ? <p className="text-sm text-muted-foreground">{alertas.aviso}</p> : null}
        {puedeTrabajar && moverA.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Mover a</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {moverA.map((grupo, i) => {
                const etapaVisual = grupo.destino === "ganado" ? "ganado_completo" : grupo.destino;
                const esFeliz = grupo.destino !== "ganado" && grupo.destino === destinoFeliz;
                return (
                  <div key={grupo.destino} className="space-y-1">
                    {esFeliz ? <Badge variant="exito">Camino principal</Badge> : null}
                    <BotonDeEtapa tono={tonoDeEtapa[etapaVisual]} anchoCh={anchoCh} onClick={() => abrirDestino(deal, grupo.destino, grupo.respuestas)}>
                      {etiquetasDestino[i]}
                    </BotonDeEtapa>
                    {grupo.respuestas.map((respuesta) => (
                      <p key={respuesta.id} className="text-xs text-muted-foreground">
                        {queHace(ficha.etapa, ficha.pendiente, respuesta, ordenDeEtapas, nombreDeEtapa, nombreDePendiente)}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
        {puedeTrabajar && enEspera.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Dejar en espera</h3>
            <p className="text-xs text-muted-foreground">El deal no cambia de etapa.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {enEspera.map((respuesta) => (
                <div key={respuesta.id} className="space-y-1">
                  <Button type="button" size="sm" variant="secondary" onClick={() => elegir(deal, respuesta)}>
                    {respuesta.etiqueta}
                  </Button>
                  <p className="text-xs text-muted-foreground">{queHace(ficha.etapa, ficha.pendiente, respuesta, ordenDeEtapas, nombreDeEtapa, nombreDePendiente)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}
        {puedeTrabajar && actividades.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Registrar actividad</h3>
            <p className="text-xs text-muted-foreground">Cuenta para los tres intentos y para el aviso de estancado.</p>
            <Button type="button" size="sm" variant="secondary" onClick={() => registrarActividad(deal, actividades)}>
              Registrar actividad
            </Button>
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
