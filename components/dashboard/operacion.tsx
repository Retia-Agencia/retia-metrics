import type { ReactNode } from "react";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Variacion } from "@/components/variacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, usd } from "@/lib/format";
import { REGLA_TIEMPO_EN_ETAPA } from "@/lib/queries/embudo-etapas";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { nombreDeEtapa, type DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { porcentajeConBase } from "@/lib/variacion";
import { Caja, Tabla, Tarjeta, tasa } from "@/components/dashboard/piezas";

export function textoComisionPrograma(comisionPorcentaje: string | null): string {
  return comisionPorcentaje != null
    ? `Comisión: ${num(Number(comisionPorcentaje), 2)} % del valor vendido de cada venta, congelado al vender.`
    : "Comisión: sin porcentaje cargado.";
}

function Comparativo({ vista }: { vista: VistaDelDashboard }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Closers</CardTitle>
      </CardHeader>
      <CardContent>
        {vista.comparativo.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nadie registró actividad en este rango.
          </p>
        ) : (
          <Tabla
            cabeceras={[
              "Closer",
              "Agendas",
              "Show",
              "% show",
              "Cierres",
              "% cierre",
              "Caja",
              "Comisión",
            ]}
          >
            {vista.comparativo.map((fila) => (
              <tr key={fila.clave}>
                <td className="py-2">
                  {fila.closerId ?? <span className="text-muted-foreground">sin closer</span>}
                </td>
                <td className="py-2 text-right">{num(fila.agendas)}</td>
                <td className="py-2 text-right">{num(fila.llamadasConShow)}</td>
                <td className="py-2 text-right">{tasa(fila.pctShow)}</td>
                <td className="py-2 text-right">{num(fila.cierres)}</td>
                <td className="py-2 text-right">{tasa(fila.pctCierre)}</td>
                <td className="py-2 text-right"><Caja caja={fila.caja} /></td>
                <td className="py-2 text-right">
                  {fila.comisionUsd === 0 && fila.ventasSinComision > 0 ? (
                    <span className="block text-muted-foreground">—</span>
                  ) : (
                    <span className="block">{usd(fila.comisionUsd)}</span>
                  )}
                  {fila.ventasSinComision > 0 ? (
                    <span className="block text-xs text-muted-foreground">
                      {num(fila.ventasSinComision)} sin % o sin valor
                    </span>
                  ) : null}
                </td>
              </tr>
            ))}
          </Tabla>
        )}
        <p className="pt-3 text-xs text-muted-foreground">
          El comparativo nunca se filtra por closer (ADR 0023).
        </p>
        <p className="pt-1 text-xs text-muted-foreground">
          Agendas y shows van por quien tomó la llamada; cierres, caja y comisión por el
          dueño del deal y quien cobró.
        </p>
        <p className="pt-1 text-xs text-muted-foreground">
          {textoComisionPrograma(vista.comisionPorcentaje)}
        </p>
      </CardContent>
    </Card>
  );
}

function EmbudoPorEtapas({ vista }: { vista: VistaDelDashboard }) {
  const conversion = vista.embudoEtapas.conversion.todas;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversión por etapa</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabla cabeceras={["Paso", "Deals", "% desde anterior", "% desde entrada"]}>
            <tr>
              <td className="py-2">Entraron</td>
              <td className="py-2 text-right">{num(conversion.entraron)}</td>
              <td className="py-2 text-right">—</td>
              <td className="py-2 text-right">—</td>
            </tr>
            {conversion.pasos.map((paso, indice) => {
              const base = indice === 0
                ? conversion.entraron
                : conversion.pasos[indice - 1]!.llegaron;
              return (
                <tr key={paso.paso}>
                  <td className="py-2">
                    {paso.paso === "vendido" ? "Vendido" : nombreDeEtapa(paso.paso)}
                  </td>
                  <td className="py-2 text-right">{num(paso.llegaron)}</td>
                  <td className="py-2 text-right">
                    {porcentajeConBase(paso.llegaron, base)}
                  </td>
                  <td className="py-2 text-right">
                    {porcentajeConBase(paso.llegaron, conversion.entraron)}
                  </td>
                </tr>
              );
            })}
          </Tabla>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tiempo en etapa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabla cabeceras={["Etapa", "Deals", "Promedio días", "Varios tramos"]}>
            {vista.embudoEtapas.tiempoEnEtapa.map((fila) => (
              <tr key={fila.etapa}>
                <td className="py-2">{nombreDeEtapa(fila.etapa)}</td>
                <td className="py-2 text-right">{num(fila.deals)}</td>
                <td className="py-2 text-right">
                  {fila.promedioDias === null ? "—" : num(fila.promedioDias, 1)}
                </td>
                <td className="py-2 text-right">{num(fila.dealsConVariosTramos)}</td>
              </tr>
            ))}
          </Tabla>
          <p className="text-xs text-muted-foreground">{REGLA_TIEMPO_EN_ETAPA}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Abiertos por etapa y owner</CardTitle>
          </CardHeader>
          <CardContent>
            {vista.embudoEtapas.abiertos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay deals abiertos.</p>
            ) : (
              <Tabla cabeceras={["Etapa", "Owner", "Deals"]}>
                {vista.embudoEtapas.abiertos.map((fila) => (
                  <tr key={`${fila.etapa}:${fila.ownerUserId ?? "sin-owner"}`}>
                    <td className="py-2">{nombreDeEtapa(fila.etapa)}</td>
                    <td>{fila.ownerNombre ?? "Sin dueño"}</td>
                    <td className="text-right">{num(fila.deals)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sin dueño por antigüedad</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabla cabeceras={["Días", "Deals"]}>
              {vista.embudoEtapas.sinDuenoPorAntiguedad.map((fila) => (
                <tr key={fila.bucket}>
                  <td className="py-2">{fila.bucket}</td>
                  <td className="text-right">{num(fila.deals)}</td>
                </tr>
              ))}
            </Tabla>
          </CardContent>
        </Card>
      </div>
      <p className="text-sm text-muted-foreground">
        El clic a la lista de estas cifras llega en un ticket aparte.
      </p>
    </div>
  );
}

/** Responde: ¿dónde se traba el embudo y con quién? */
export function Operacion({
  vista,
  detalles,
  dealsContraAgendas,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  dealsContraAgendas: ReactNode;
}) {
  const anterior = vista.anterior?.embudo;
  const filas = [
    {
      titulo: "Agendas",
      actual: vista.embudo.agendas,
      previo: anterior?.agendas,
      paso: "—",
      detalle: detalles?.agendas,
    },
    {
      titulo: "Shows",
      actual: vista.embudo.llamadasConShow,
      previo: anterior?.llamadasConShow,
      paso: porcentajeConBase(vista.embudo.llamadasConShow, vista.embudo.agendas),
      detalle: detalles?.shows,
    },
    {
      titulo: "Cierres",
      actual: vista.embudo.cierres,
      previo: anterior?.cierres,
      paso: porcentajeConBase(vista.embudo.cierres, vista.embudo.llamadasConShow),
      detalle: detalles?.cierres,
    },
  ];

  return (
    <section id="operacion" className="scroll-mt-4 space-y-4">
      <h2 className="text-xl font-semibold">Operación comercial</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embudo comercial</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabla cabeceras={["Paso", "A", "B", "B → A", "% del paso"]}>
            {filas.map((fila) => (
              <tr key={fila.titulo}>
                <td className="py-2">{fila.titulo}</td>
                <td className="py-2 text-right">
                  <CifraConLista titulo={fila.titulo} detalle={fila.detalle}>
                    {num(fila.actual)}
                  </CifraConLista>
                </td>
                <td className="py-2 text-right">
                  {fila.previo === undefined ? "—" : num(fila.previo)}
                </td>
                <td className="py-2 text-right">
                  {fila.previo === undefined ? (
                    "—"
                  ) : (
                    <Variacion actual={fila.actual} anterior={fila.previo} />
                  )}
                </td>
                <td className="py-2 text-right">{fila.paso}</td>
              </tr>
            ))}
          </Tabla>
        </CardContent>
      </Card>

      {dealsContraAgendas}
      <Comparativo vista={vista} />
      <EmbudoPorEtapas vista={vista} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Motivos de pérdida</CardTitle>
          </CardHeader>
          <CardContent>
            {vista.embudoEtapas.motivosDePerdida.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ningún deal perdido con motivo en este rango.
              </p>
            ) : (
              <Tabla cabeceras={["Motivo", "Deals", "Ticket estimado"]}>
                {vista.embudoEtapas.motivosDePerdida.map((motivo) => (
                  <tr key={motivo.motivo}>
                    <td className="py-2">{motivo.motivo}</td>
                    <td className="py-2 text-right">{num(motivo.deals)}</td>
                    <td className="py-2 text-right">
                      {usd(motivo.ticketPerdidoUsd)}
                      {motivo.dealsSinTicket > 0 ? (
                        <span className="block text-xs text-muted-foreground">
                          {num(motivo.dealsSinTicket)} sin ticket
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </CardContent>
        </Card>
        <Tarjeta
          titulo="Leads"
          valor={
            vista.leads.leads === null ? (
              "—"
            ) : (
              <CifraConLista titulo="Leads" detalle={detalles?.leads}>
                {num(vista.leads.leads)}
              </CifraConLista>
            )
          }
          nota={
            vista.leads.metaDelRango === null
              ? `${num(vista.leads.diasHabiles)} días hábiles · sin meta de leads en la cohorte`
              : `meta ${num(vista.leads.metaDelRango)} · ${tasa(vista.leads.cumplimiento)}`
          }
        />
      </div>
    </section>
  );
}
