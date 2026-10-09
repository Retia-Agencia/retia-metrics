"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { fecha } from "@/lib/format";
import type { AlertasDelDeal, FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { BotonDeEtapa } from "../boton-de-etapa";
import { gruposDeTransicion } from "../pregunta-de-etapa";
import { useResponder, type DealQueResponde } from "../responder-pregunta";
import { DialogoAnotar } from "../dialogo-anotar";
import type { CorreccionCliente, MapaTransiciones } from "../transiciones";
import type { TonoEtapa } from "../etapa-tono";

export function FichaTransicion({
  ficha,
  opciones,
  mapa,
  correccion,
  ordenDeEtapas,
  nombreDeEtapa,
  tonoDeEtapa,
  rutaDeLaFicha,
  puedeTrabajar,
  alertas,
}: {
  ficha: FichaDeDeal;
  opciones: OpcionesDeFicha;
  mapa: MapaTransiciones;
  correccion: CorreccionCliente | null;
  ordenDeEtapas: readonly EtapaDeal[];
  nombreDeEtapa: Record<EtapaDeal, string>;
  tonoDeEtapa: Record<EtapaDeal, TonoEtapa>;
  rutaDeLaFicha: string;
  puedeTrabajar: boolean;
  alertas: AlertasDelDeal | null;
}) {
  const router = useRouter();
  const { abrirDestino, corregir, dialogo } = useResponder(mapa, opciones, nombreDeEtapa, () => router.refresh());
  const deal: DealQueResponde = {
    dealId: ficha.dealId,
    etapa: ficha.etapa,
    pendiente: ficha.pendiente,
    nombreLead: ficha.lead.nombre ?? ficha.lead.email,
    rutaDeLaFicha,
    fechaLimiteSugerida: ficha.fechaLimiteSugerida,
    linkAgenda: ficha.linkAgenda,
    tieneCitaVigente: ficha.tieneCitaVigente,
    saldo: ficha.saldo.saldo,
    moneda: ficha.saldo.moneda,
    llamada: ficha.llamadas
      .filter((llamada) => llamada.anuladoEn == null && llamada.resultado === "agendada")
      .map((llamada) => ({
        id: llamada.id,
        fecha: llamada.fechaAgenda,
        closerNombre: llamada.closerNombre,
        notas: llamada.notas,
      }))[0] ?? null,
  };
  const { moverA } = gruposDeTransicion(ficha.etapa, ficha.pendiente, ordenDeEtapas);
  const etiquetasDestino = moverA.map((grupo) => grupo.destino === "ganado" ? "Ganado · registrar pago" : nombreDeEtapa[grupo.destino]);
  if (ficha.anulado) return null;

  return (
    <Card className="border-l-4 border-tono-exito">
      <CardHeader><CardTitle>Transición</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {alertas?.propiedades.length ? (
          <p className="text-sm text-tono-peligro">
            {alertas.propiedades.map((falta) => falta.mensaje).join(" ")}
          </p>
        ) : null}
        {alertas?.aviso ? <p className="text-sm text-muted-foreground">{alertas.aviso}</p> : null}
        {puedeTrabajar ? (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Mover a</h3>
                <p className="text-xs text-muted-foreground">Cambia la etapa del deal.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {moverA.map((grupo, i) => {
                  const etapaVisual = grupo.destino === "ganado" ? "ganado_completo" : grupo.destino;
                  return (
                    <BotonDeEtapa key={grupo.destino} tono={tonoDeEtapa[etapaVisual]} onClick={() => abrirDestino(deal, grupo.destino, grupo.respuestas)}>
                      {etiquetasDestino[i]}
                    </BotonDeEtapa>
                  );
                })}
                {correccion ? (
                  <Button type="button" className="w-full" variant="destructive" onClick={() => corregir(deal, correccion)}>
                    Corregir
                  </Button>
                ) : null}
              </div>
            </section>
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Anotar</h3>
                <p className="text-xs text-muted-foreground">Deja un comentario o el próximo paso sin cambiar la etapa.</p>
              </div>
              <DialogoAnotar
                dealId={ficha.dealId}
                etapa={ficha.etapa}
                pendienteActual={ficha.pendiente}
                nombreLead={deal.nombreLead}
                opciones={opciones}
                onGuardado={() => router.refresh()}
              />
            </section>
          </div>
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
