"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { fecha } from "@/lib/format";
import type { AlertasDelDeal, FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { BotonDeEtapa } from "../boton-de-etapa";
import { gruposDeTransicion, gruposSinDueno, type ClaveDestino } from "../pregunta-de-etapa";
import {
  DESCRIPCION_DE_CORREGIR,
  DESCRIPCION_DE_DESTINO,
  type DestinoConDescripcion,
} from "../descripcion-de-destino";
import { useResponder, type DealQueResponde } from "../responder-pregunta";
import { DialogoAnotar } from "../dialogo-anotar";
import type { CorreccionCliente, MapaTransiciones } from "../transiciones";
import type { TonoEtapa } from "../etapa-tono";

/** El destino de un botón siempre tiene descripción (nunca es una etapa de pago cruda). */
function tieneDescripcion(destino: ClaveDestino): destino is DestinoConDescripcion {
  return destino in DESCRIPCION_DE_DESTINO;
}

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
  sinDueno = false,
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
  /**
   * El deal no tiene dueño y la sesión trabaja leads (ticket 229, A-138): la Transición
   * ofrece solo los tres gestos que reclaman el deal solos en el servidor —Registrar
   * contacto, "Lo estoy trabajando" y Anotar— con un aviso de que queda a su nombre. No
   * se cruza con `puedeTrabajar`: cuando este es true (dueño o administra), manda la vista
   * completa de siempre.
   */
  sinDueno?: boolean;
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
  // Con dueño (o administrando) se ofrece todo; sin dueño, solo los tres gestos que reclaman
  // el deal solos (ticket 229). `gruposSinDueno` recorta "Mover a" a esas respuestas.
  const gruposCompletos = gruposDeTransicion(ficha.etapa, ficha.pendiente, ordenDeEtapas);
  const { moverA } = puedeTrabajar ? gruposCompletos : gruposSinDueno(gruposCompletos);
  const etiquetasDestino = moverA.map((grupo) => grupo.destino === "ganado" ? "Ganado · registrar pago" : nombreDeEtapa[grupo.destino]);
  if (ficha.anulado) return null;
  // Ni dueño/administrador, ni un closer que pueda tomarlo: la tarjeta no se muestra.
  if (!puedeTrabajar && !sinDueno) return null;

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
        {!puedeTrabajar && sinDueno ? (
          <p className="rounded-lg bg-tono-info-suave p-3 text-sm text-tono-info">
            Este deal no tiene dueño. Si lo trabajas, queda a tu nombre.
          </p>
        ) : null}
        {puedeTrabajar || sinDueno ? (
          <div className="grid gap-6 md:grid-cols-2">
            <section className="space-y-3">
              <div>
                <h3 className="text-sm font-medium">Mover a</h3>
                <p className="text-xs text-muted-foreground">Cambia la etapa del deal.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {moverA.map((grupo, i) => {
                  const etapaVisual = grupo.destino === "ganado" ? "ganado_completo" : grupo.destino;
                  const descripcion = tieneDescripcion(grupo.destino) ? DESCRIPCION_DE_DESTINO[grupo.destino] : null;
                  return (
                    <div key={grupo.destino} className="space-y-1">
                      <BotonDeEtapa tono={tonoDeEtapa[etapaVisual]} onClick={() => abrirDestino(deal, grupo.destino, grupo.respuestas)}>
                        {etiquetasDestino[i]}
                      </BotonDeEtapa>
                      {descripcion ? <p className="text-xs text-muted-foreground">{descripcion}</p> : null}
                    </div>
                  );
                })}
                {/* Corregir pide dueño (es administrar o del propio dueño): nunca sin dueño. */}
                {puedeTrabajar && correccion ? (
                  <div className="space-y-1">
                    <Button type="button" className="w-full" variant="destructive" onClick={() => corregir(deal, correccion)}>
                      Corregir
                    </Button>
                    <p className="text-xs text-muted-foreground">{DESCRIPCION_DE_CORREGIR}</p>
                  </div>
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
        {ficha.pendiente === "proxima_cohorte" && ficha.cohorteDestino && !ficha.cohorteDestino.inicioVentas ? (
          <p className="text-xs text-muted-foreground">
            Se retoma cuando se defina el inicio de ventas de {ficha.cohorteDestino.codigo}.
          </p>
        ) : null}
      </CardContent>
      {dialogo}
    </Card>
  );
}
