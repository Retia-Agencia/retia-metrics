"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import type { RequisitoFaltante } from "@/lib/deals/requisitos";
import { fecha } from "@/lib/format";
import type { AlertasDelDeal, FichaDeDeal, OpcionesDeFicha } from "@/lib/queries/ficha-deal";
import { BotonDeEtapa } from "../boton-de-etapa";
import { queHace, respuestasPorDestino } from "../pregunta-de-etapa";
import { useResponder, type DealQueResponde } from "../responder-pregunta";
import type { MapaTransiciones } from "../transiciones";
import type { TonoEtapa } from "../etapa-tono";

const ANCLA_DE_REQUISITO: Record<RequisitoFaltante["codigo"], string> = {
  transicion_no_permitida: "campos", cohorte: "campos", dueno: "campos",
  actividad: "actividades", contacto: "actividades", llamada_con_fecha: "llamadas",
  llamada_sucedio: "llamadas", llamada_fallida: "llamadas", valor_vendido: "pago",
  area_declarada: "campos", fecha_limite_pago: "pago", cohorte_destino: "pago",
  fecha_seguimiento: "campos", abono: "pago", saldo_pendiente: "pago",
  saldo_en_cero: "pago", sin_abonos: "pago", motivo: "campos",
};

function Requisitos({ faltan }: { faltan: RequisitoFaltante[] }) {
  if (faltan.length === 0) return <p className="text-sm text-muted-foreground">Nada pendiente.</p>;
  return (
    <ul className="space-y-1 text-sm">
      {faltan.map((falta) => (
        <li key={falta.codigo}>
          <a href={`#${ANCLA_DE_REQUISITO[falta.codigo]}`} className="outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
            {falta.mensaje}
          </a>
        </li>
      ))}
    </ul>
  );
}

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
  if (ficha.anulado) return null;

  return (
    <Card className="border-l-4 border-tono-exito">
      <CardHeader><CardTitle className="flex items-center gap-2">Transición <Badge variant="exito">Siguiente paso</Badge></CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {alertas?.propiedades.length ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Le falta a la etapa actual</h3>
            <Requisitos faltan={alertas.propiedades} />
          </section>
        ) : null}
        {alertas?.aviso ? <p className="text-sm text-muted-foreground">{alertas.aviso}</p> : null}
        {alertas?.paraAvanzar.length ? (
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Para avanzar</h3>
            {alertas.paraAvanzar.map((destino) => (
              <div key={destino.destino} className="space-y-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {destino.nombreDestino}
                  {destino.caminoFeliz ? <Badge variant="exito">Camino principal</Badge> : null}
                </p>
                <Requisitos faltan={destino.faltan} />
              </div>
            ))}
          </section>
        ) : null}
        {puedeTrabajar && grupos.destinos.length > 0 ? (
          <section className="space-y-2">
            <h3 className="text-sm font-medium">Mover a</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {grupos.destinos.map((grupo, i) => {
                const etapaVisual = grupo.destino === "ganado" ? "ganado_completo" : grupo.destino;
                return (
                  <div key={grupo.destino} className="space-y-1">
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
        {puedeTrabajar ? <section className="space-y-2">
          <h3 className="text-sm font-medium">Registrar</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {(["contacto", "intento", "nota"] as const).map((accion) => (
              <div key={accion} className="space-y-1">
                <Button type="button" size="sm" variant="secondary" onClick={() => registrar(deal, accion)}>
                  {accion === "contacto" ? "Contacto" : accion === "intento" ? "Intento" : "Nota"}
                </Button>
                <p className="text-xs text-muted-foreground">{queHace(ficha.etapa, ficha.pendiente, accion, ordenDeEtapas, nombreDeEtapa, nombreDePendiente)}</p>
              </div>
            ))}
            {respuestasSinCambio.map((respuesta) => (
              <div key={respuesta.id} className="space-y-1">
                <Button type="button" size="sm" variant={respuesta.id === "descartar" ? "outline" : "secondary"} onClick={() => elegir(deal, respuesta)}>
                  {respuesta.etiqueta}
                </Button>
                <p className="text-xs text-muted-foreground">{queHace(ficha.etapa, ficha.pendiente, respuesta, ordenDeEtapas, nombreDeEtapa, nombreDePendiente)}</p>
              </div>
            ))}
          </div>
        </section> : null}
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
