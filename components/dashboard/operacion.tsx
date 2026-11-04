import type { ReactNode } from "react";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, usd } from "@/lib/format";
import { REGLA_TIEMPO_EN_ETAPA } from "@/lib/queries/embudo-etapas";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import {
  claveDeAbiertos,
  nombreDeEtapa,
  type DetalleDeCifra,
  type DetallesDeOperacion,
  type DetallesDelDashboard,
} from "@/lib/queries/vista-metrica";
import { cambioEnPalabras, porcentajeConBase } from "@/lib/variacion";
import { contextoDeCifra } from "@/lib/contexto-de-cifra";
import { nombreCorto } from "@/lib/vocabulario-metricas";
import type { VistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { ContextoDeCifra } from "@/components/dashboard/contexto-de-cifra";
import { Caja, Tabla, Tarjeta, tasa } from "@/components/dashboard/piezas";
import { ComoSeCalcula } from "@/components/como-se-calcula";

export function textoComisionPrograma(comisionPorcentaje: string | null): string {
  return comisionPorcentaje != null
    ? `Comisión: ${num(Number(comisionPorcentaje), 2)} % del valor vendido de cada venta, congelado al vender.`
    : "Comisión: sin porcentaje cargado.";
}

/** Una cifra que abre su lista si tiene detalle; sin detalle (o sin filas) se pinta tal cual. */
function Celda({ titulo, detalle, children }: { titulo: string; detalle?: DetalleDeCifra; children: ReactNode }) {
  return <CifraConLista titulo={titulo} detalle={detalle}>{children}</CifraConLista>;
}

/** El comparativo entre closers (ADR 0023). Lo usan Comercial y, con el rango de hoy, la pestaña Hoy (252). */
export function Comparativo({ vista, detalles, titulo = "Closers", contexto }: {
  vista: VistaDelDashboard;
  detalles?: DetallesDeOperacion["comparativo"];
  titulo?: string;
  /** El periodo, la cohorte y el closer de la tarjeta (ticket 372); la pestaña Hoy no lo pasa. */
  contexto?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{titulo}</CardTitle>
        {contexto ? <ContextoDeCifra texto={contexto} /> : null}
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
              "Recaudado",
              "Comisión",
            ]}
          >
            {vista.comparativo.map((fila) => {
              const celdas = detalles?.[fila.clave];
              const quien = fila.closerId ?? "Sin closer";
              return (
              <tr key={fila.clave}>
                <td className="py-2">
                  {fila.closerId ?? <span className="text-muted-foreground">Sin closer</span>}
                </td>
                <td className="py-2 text-right">
                  <Celda titulo={`Agendas de ${quien}`} detalle={celdas?.agendas}>{num(fila.agendas)}</Celda>
                </td>
                <td className="py-2 text-right">
                  <Celda titulo={`Shows de ${quien}`} detalle={celdas?.shows}>{num(fila.llamadasConShow)}</Celda>
                </td>
                <td className="py-2 text-right">
                  <Celda titulo={`Grupo de citas de ${quien} (base del % de show)`} detalle={celdas?.grupo_citas}>{tasa(fila.pctShow)}</Celda>
                </td>
                <td className="py-2 text-right">
                  <Celda titulo={`Cierres de ${quien}`} detalle={celdas?.cierres}>{num(fila.cierres)}</Celda>
                </td>
                <td className="py-2 text-right">
                  <Celda titulo={`Grupo con show de ${quien} (base del % de cierre)`} detalle={celdas?.grupo_shows}>{tasa(fila.pctCierre)}</Celda>
                </td>
                <td className="py-2 text-right">
                  <Celda titulo={`Recaudado por ${quien}`} detalle={celdas?.caja}><Caja caja={fila.caja} /></Celda>
                </td>
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
              );
            })}
          </Tabla>
        )}
        <ComoSeCalcula>
          <p><strong>Agendas:</strong> quien tomó la llamada.</p>
          <p><strong>Show:</strong> quien tomó la llamada.</p>
          <p><strong>% show y % cierre:</strong> van sobre el grupo de citas; cada deal cuenta en el closer de su último show o, sin show, de su última cita.</p>
          <p><strong>Cierres:</strong> el dueño actual del deal.</p>
          <p><strong>Comisión:</strong> el dueño actual del deal.</p>
          <p><strong>Recaudado:</strong> quien registró el abono.</p>
          <p><strong>Sin closer:</strong> ventas, citas o abonos que no tienen closer; no entran en la comisión de nadie.</p>
        </ComoSeCalcula>
        <p className="pt-1 text-sm text-muted-foreground">
          {textoComisionPrograma(vista.comisionPorcentaje)}
        </p>
      </CardContent>
    </Card>
  );
}

/**
 * Las agendas por semana (ticket 189): creadas, ocurridas con su show y su no-show sobre las mismas
 * personas (ADR 0079), y las futuras aparte, porque una cita que viene es agenda y no resultado.
 */
function AgendasPorSemana({ semanas, proximas, contexto }: Pick<DetallesDeOperacion, "semanas" | "proximas"> & { contexto: string }) {
  if (semanas.length === 0 && proximas.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Agendas por semana</CardTitle>
        <ContextoDeCifra texto={contexto} />
      </CardHeader>
      <CardContent>
        <Tabla cabeceras={["Semana", "Creadas", "Ocurridas", "Show", "No-show", "Pendientes", "% no-show"]}>
          {semanas.map((s) => {
            const nombre = s.semana.desde === s.semana.hasta
              ? fecha(s.semana.desde)
              : `${fecha(s.semana.desde)} a ${fecha(s.semana.hasta)}`;
            const cifra = (titulo: string, detalle: DetalleDeCifra) => (
              <td className="py-2 text-right">
                <Celda titulo={`${titulo} · ${nombre}`} detalle={detalle}>
                  {num(detalle.resumen.subtotal.cantidad)}
                </Celda>
              </td>
            );
            return (
              <tr key={s.semana.desde}>
                <td className="py-2">{nombre}</td>
                {cifra("Agendas creadas", s.creadas)}
                {cifra("Deals con cita ocurrida", s.ocurridas)}
                {cifra("Deals con show", s.shows)}
                {cifra("Deals sin show", s.noShows)}
                {cifra("Citas pasadas sin resultado", s.pendientes)}
                <td className="py-2 text-right">{tasa(s.pctNoShow)}</td>
              </tr>
            );
          })}
        </Tabla>
        <p className="pt-3 text-sm text-muted-foreground">
          Semanas de lunes a domingo en Bogotá, recortadas al rango; del programa entero, sin filtro de closer.
          Creadas, por el día en que se agendó la cita; ocurridas, show, no-show y pendientes, por deal y por el
          día de la cita ya pasada (cada semana es su grupo, así que no suman el rango).
        </p>
        {proximas.length > 0 ? (
          <div className="pt-4">
            <h3 className="pb-2 text-sm font-medium">Próximas agendas, desde hoy</h3>
            <Tabla cabeceras={["Semana", "Futuras"]}>
              {proximas.map((p) => {
                const nombre = p.semana.desde === p.semana.hasta
                  ? fecha(p.semana.desde)
                  : `${fecha(p.semana.desde)} a ${fecha(p.semana.hasta)}`;
                return (
                  <tr key={p.semana.desde}>
                    <td className="py-2">{nombre}</td>
                    <td className="py-2 text-right">
                      <Celda titulo={`Agendas futuras · ${nombre}`} detalle={p.futuras}>
                        {num(p.futuras.resumen.subtotal.cantidad)}
                      </Celda>
                    </td>
                  </tr>
                );
              })}
            </Tabla>
            <p className="pt-2 text-sm text-muted-foreground">
              Citas que siguen agendadas y aún no llegan: son agenda, no resultado, y no entran al no-show.
              No dependen del periodo elegido.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function EmbudoPorEtapas({ vista, detalles, veEquipo, contexto }: {
  vista: VistaDelDashboard;
  detalles?: DetallesDeOperacion["embudo"];
  veEquipo: boolean;
  contexto: string;
}) {
  const conversion = vista.embudoEtapas.conversion.todas;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversión por etapa</CardTitle>
          <ContextoDeCifra texto={contexto} />
        </CardHeader>
        <CardContent>
          <Tabla cabeceras={["Paso", "Deals", "% que pasó al siguiente paso"]}>
            <tr>
              <td className="py-2">Entraron</td>
              <td className="py-2 text-right">
                <Celda titulo="Entraron al embudo" detalle={detalles?.entraron}>{num(conversion.entraron)}</Celda>
              </td>
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
                  <td className="py-2 text-right">
                    <Celda
                      titulo={`Llegaron a ${paso.paso === "vendido" ? "Vendido" : nombreDeEtapa(paso.paso)}`}
                      detalle={detalles?.pasos[paso.paso]}
                    >
                      {num(paso.llegaron)}
                    </Celda>
                  </td>
                  <td className="py-2 text-right">
                    {porcentajeConBase(paso.llegaron, base)}
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
          <ContextoDeCifra texto={contexto} />
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabla cabeceras={["Etapa", "Deals", "Promedio días"]}>
            {vista.embudoEtapas.tiempoEnEtapa.map((fila) => (
              <tr key={fila.etapa}>
                <td className="py-2">{nombreDeEtapa(fila.etapa)}</td>
                <td className="py-2 text-right">
                  <Celda titulo={`Salieron de ${nombreDeEtapa(fila.etapa)}`} detalle={detalles?.tiempo[fila.etapa]}>
                    {num(fila.deals)}
                  </Celda>
                </td>
                <td className="py-2 text-right">
                  {fila.promedioDias === null ? "—" : num(fila.promedioDias, 1)}
                </td>
              </tr>
            ))}
          </Tabla>
          <p className="text-sm text-muted-foreground">{REGLA_TIEMPO_EN_ETAPA}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {veEquipo ? <Card>
          <CardHeader>
            <CardTitle className="text-base">Abiertos por etapa y owner</CardTitle>
            <ContextoDeCifra texto="Foto de hoy" />
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
                    <td className="text-right">
                      <Celda
                        titulo={`Abiertos en ${nombreDeEtapa(fila.etapa)} · ${fila.ownerNombre ?? "sin dueño"}`}
                        detalle={detalles?.abiertos[claveDeAbiertos(fila.etapa, fila.ownerUserId)]}
                      >
                        {num(fila.deals)}
                      </Celda>
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </CardContent>
        </Card> : null}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sin dueño por antigüedad</CardTitle>
            <ContextoDeCifra texto="Foto de hoy" />
          </CardHeader>
          <CardContent>
            {vista.embudoEtapas.sinDuenoPorAntiguedad.every((fila) => fila.deals === 0) ? (
              <p className="text-sm text-muted-foreground">Todos los deals abiertos tienen dueño.</p>
            ) : (
              <Tabla cabeceras={["Días", "Deals"]}>
                {vista.embudoEtapas.sinDuenoPorAntiguedad.map((fila) => (
                  <tr key={fila.bucket}>
                    <td className="py-2">{fila.bucket}</td>
                    <td className="text-right">
                      <Celda titulo={`Sin dueño, ${fila.bucket} días`} detalle={detalles?.sinDueno[fila.bucket]}>
                        {num(fila.deals)}
                      </Celda>
                    </td>
                  </tr>
                ))}
              </Tabla>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/** Responde: ¿dónde se traba el embudo y con quién? */
export function Operacion({
  vista,
  detalles,
  detallesOperacion,
  dealsContraAgendas,
  dealsContraAgendasVista,
  detalleRegistros,
  hoy,
  veEquipo = true,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  /** Sin equipo comercial (paid trafficker, ticket 102): sin comparativo ni abiertos por owner. */
  veEquipo?: boolean;
  /** El comparativo y el embudo por etapas, celda por celda (ticket 188). */
  detallesOperacion?: DetallesDeOperacion;
  dealsContraAgendas: ReactNode;
  /** Los deals partidos por el envío que los abrió (372): alimentan las dos primeras filas del embudo. */
  dealsContraAgendasVista?: VistaDealsContraAgendas;
  /** Los registros del periodo (el primer paso del embudo). */
  detalleRegistros?: DetalleDeCifra;
  /** El día de hoy en Bogotá: el contexto dice "hoy" cuando el periodo termina hoy. */
  hoy: string;
}) {
  const anterior = vista.anterior?.embudo;
  const grupo = vista.embudo.grupo;
  const closerElegido = vista.closers.find((c) => c.id === vista.claveCloser)?.label ?? null;
  const contexto = contextoDeCifra({
    cohorte: vista.filtroDeCohorte.elegida?.codigo ?? null,
    rango: vista.seleccion.rango,
    hoy,
    closer: closerElegido,
  });
  // El comparativo entre closers (ADR 0023) y las agendas por semana son del programa entero, sin filtro de closer.
  const contextoDelPrograma = contextoDeCifra({
    cohorte: vista.filtroDeCohorte.elegida?.codigo ?? null,
    rango: vista.seleccion.rango,
    hoy,
    closer: null,
  });

  // Los dos primeros pasos nacen del formulario y no se atribuyen a un closer: con closer, "—" (N3).
  const conVista = dealsContraAgendasVista?.disponible ? dealsContraAgendasVista : null;
  const finalA = conVista?.a.puntos.at(-1);
  const finalB = conVista?.b?.puntos.slice(0, conVista.a.puntos.length).at(-1);
  const completoA = conVista?.porOrigen.completo.a.puntos.at(-1);
  const registros = detalleRegistros?.resumen.disponible ? detalleRegistros.resumen.subtotal.cantidad : null;

  const filas: {
    titulo: string;
    actual: number | null;
    previo: number | null | undefined;
    paso: string;
    detalle?: DetalleDeCifra;
  }[] = [
    { titulo: nombreCorto("registros"), actual: registros, previo: undefined, paso: "—", detalle: detalleRegistros },
    {
      titulo: "Deals creados",
      actual: conVista ? (finalA?.deals ?? 0) : null,
      previo: conVista ? (finalB?.deals ?? undefined) : undefined,
      paso: "—",
      detalle: conVista?.detalles.deals_creados,
    },
    {
      titulo: nombreCorto("agendadas"),
      actual: vista.embudo.agendas,
      previo: anterior?.agendas,
      // Solo los que llenaron el formulario completo: un parcial casi nunca agenda (ADR 0069).
      paso: completoA ? tasa(completoA.pctAgendaron) : "—",
      detalle: detalles?.agendas,
    },
    {
      titulo: nombreCorto("shows"),
      actual: vista.embudo.llamadasConShow,
      previo: anterior?.llamadasConShow,
      // Las tasas del paso salen del grupo de citas (ADR 0079), no de dividir estas cantidades.
      paso: porcentajeConBase(grupo.conShow, grupo.deals),
      detalle: detalles?.shows,
    },
    {
      titulo: nombreCorto("ventas"),
      actual: vista.embudo.cierres,
      previo: anterior?.cierres,
      paso: porcentajeConBase(grupo.vendidos, grupo.conShow),
      detalle: detalles?.cierres,
    },
  ];

  return (
    <section id="operacion" className="scroll-mt-4 space-y-4">
      <h2 className="text-xl font-semibold">Operación comercial</h2>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Embudo comercial</CardTitle>
          <ContextoDeCifra texto={contexto} />
        </CardHeader>
        <CardContent>
          <Tabla cabeceras={["Paso", "Periodo", "Comparación", "Cambio", "% del paso"]}>
            {filas.map((fila) => (
              <tr key={fila.titulo}>
                <td className="py-2">{fila.titulo}</td>
                <td className="py-2 text-right">
                  {fila.actual === null ? "—" : (
                    <CifraConLista titulo={fila.titulo} detalle={fila.detalle}>
                      {num(fila.actual)}
                    </CifraConLista>
                  )}
                </td>
                <td className="py-2 text-right">
                  {fila.previo == null ? "—" : num(fila.previo)}
                </td>
                <td className="py-2 text-right">
                  {fila.previo == null || fila.actual === null ? "—" : cambioEnPalabras(fila.actual, fila.previo)}
                </td>
                <td className="py-2 text-right">{fila.paso}</td>
              </tr>
            ))}
          </Tabla>
          <p className="pt-3 text-sm text-muted-foreground">
            Agendadas es el % de los deals de un formulario completo que agendaron: un parcial casi nunca agenda y
            tiene su tasa aparte, más abajo. Shows y ventas van sobre el mismo grupo:{" "}
            <CifraConLista titulo="Deals con cita ocurrida" detalle={detalles?.grupo_citas}>
              {num(grupo.deals)}
            </CifraConLista>{" "}
            deals con cita ya ocurrida en el rango,{" "}
            <CifraConLista titulo="Deals del grupo con show" detalle={detalles?.grupo_shows}>
              {num(grupo.conShow)}
            </CifraConLista>{" "}
            con show y{" "}
            <CifraConLista titulo="Deals del grupo con show y vendidos hoy" detalle={detalles?.grupo_vendidos}>
              {num(grupo.vendidos)}
            </CifraConLista>{" "}
            de ellos vendidos hoy. Agenda → venta: {tasa(vista.embudo.agendaAVenta)}.
          </p>
          {vista.embudo.pendientesDeResultado > 0 ? (
            <p className="pt-1 text-xs text-muted-foreground">
              <CifraConLista titulo="Citas pasadas sin resultado" detalle={detalles?.grupo_pendientes}>{num(vista.embudo.pendientesDeResultado)}</CifraConLista>
              {vista.embudo.pendientesDeResultado === 1 ? " cita ya pasó sin resultado registrado" : " citas ya pasaron sin resultado registrado"}: no cuentan en el % de show ni en el % de cierre hasta que el closer lo registre.
            </p>
          ) : null}
          {vista.embudo.madurando ? (
            <p className="pt-1 text-sm text-muted-foreground">
              Aún madurando: el rango terminó hace menos de 30 días y su gente todavía puede comprar.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {veEquipo ? <Comparativo vista={vista} detalles={detallesOperacion?.comparativo} titulo="Por closer" contexto={contextoDelPrograma} /> : null}
      {detallesOperacion ? <AgendasPorSemana semanas={detallesOperacion.semanas} proximas={detallesOperacion.proximas} contexto={contextoDelPrograma} /> : null}
      {dealsContraAgendas}

      <details className="group rounded-lg border border-border">
        <summary className="cursor-pointer select-none px-4 py-3 text-base font-semibold">
          Diagnóstico
          <span className="block text-xs font-normal text-muted-foreground">
            Tiempo en etapa, deals abiertos, motivos de pérdida y leads.
          </span>
        </summary>
        <div className="space-y-4 p-4 pt-0">
          <EmbudoPorEtapas vista={vista} detalles={detallesOperacion?.embudo} veEquipo={veEquipo} contexto={contexto} />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Motivos de pérdida</CardTitle>
                <ContextoDeCifra texto={contexto} />
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
              titulo={`Leads · ${contexto}`}
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
        </div>
      </details>
    </section>
  );
}
