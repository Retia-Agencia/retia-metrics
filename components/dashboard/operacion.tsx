import type { ReactNode } from "react";
import { CifraConLista } from "@/components/cifra-con-lista";
import { ComoSeCalcula } from "@/components/como-se-calcula";
import { ContextoDeCifra } from "@/components/dashboard/contexto-de-cifra";
import {
  BarraApilada100,
  BarrasHorizontales,
  EmbudoDeBarras,
  LeyendaDeBarras,
} from "@/components/graficas/barras";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Variacion } from "@/components/variacion";
import { fecha, num, pct, usd } from "@/lib/format";
import { contextoDeCifra } from "@/lib/contexto-de-cifra";
import { REGLA_TIEMPO_EN_ETAPA } from "@/lib/queries/embudo-etapas";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { VistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import {
  claveDeAbiertos,
  nombreDeEtapa,
  type DetalleDeCifra,
  type DetallesDeOperacion,
  type DetallesDelDashboard,
} from "@/lib/queries/vista-metrica";
import { nombreCorto } from "@/lib/vocabulario-metricas";
import { Caja, Tabla, tasa } from "@/components/dashboard/piezas";

const LEYENDA_DE_AGENDAS = [
  { etiqueta: "Show", tono: "exito" },
  { etiqueta: "No-show", tono: "peligro" },
  { etiqueta: "Pendientes", tono: "alerta" },
] as const;

const LEYENDA_DE_ETAPAS = [
  { etiqueta: "Pasaron", tono: "exito" },
  { etiqueta: "Siguen aquí", tono: "alerta" },
  { etiqueta: "Se perdieron aquí", tono: "peligro" },
  { etiqueta: "Otro camino", tono: "info" },
] as const;

export function textoComisionPrograma(comisionPorcentaje: string | null): string {
  return comisionPorcentaje != null
    ? `Comisión: ${num(Number(comisionPorcentaje), 2)} % del valor vendido de cada venta, congelado al vender.`
    : "Comisión: sin porcentaje cargado.";
}

function Celda({ titulo, detalle, children }: { titulo: string; detalle?: DetalleDeCifra; children: ReactNode }) {
  return (
    <CifraConLista titulo={titulo} detalle={detalle}>
      {children}
    </CifraConLista>
  );
}

function BarraDeTasa({ valor }: { valor: number | null }) {
  return (
    <span className="mt-1 block h-1.5 w-20 rounded-full bg-muted">
      <span
        className="block h-1.5 rounded-full bg-primary"
        style={{ width: `${Math.max(0, Math.min(100, (valor ?? 0) * 100))}%` }}
      />
    </span>
  );
}

export function Comparativo({
  vista,
  detalles,
  titulo = "¿Cómo va cada closer?",
  contexto,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDeOperacion["comparativo"];
  titulo?: string;
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
          <p className="text-sm text-muted-foreground">Nadie registró actividad en este rango.</p>
        ) : (
          <div className="overflow-x-auto [&_table]:min-w-[44rem] [&_td]:px-3 [&_th]:px-3">
            <Tabla
              cabeceras={[
                "Closer",
                "Agendas",
                "Show",
                "% show",
                "Cierres",
                "% cierre",
                "Entró a caja",
                "Comisión",
              ]}
            >
              {vista.comparativo.map((fila) => {
                const c = detalles?.[fila.clave];
                const quien = fila.closerId ?? "Sin closer";
                const motivoSinComision = `${num(fila.ventasSinComision)} sin porcentaje o sin valor vendido`;
                return (
                  <tr key={fila.clave}>
                    <td className="py-2">
                      {fila.closerId ?? <span className="text-muted-foreground">Sin closer</span>}
                    </td>
                    <td className="text-right">
                      <Celda titulo={`Agendas de ${quien}`} detalle={c?.agendas}>
                        {num(fila.agendas)}
                      </Celda>
                    </td>
                    <td className="text-right">
                      <Celda titulo={`Shows de ${quien}`} detalle={c?.shows}>
                        {num(fila.llamadasConShow)}
                      </Celda>
                    </td>
                    <td className="text-right">
                      <Celda titulo={`Grupo de citas de ${quien}`} detalle={c?.grupo_citas}>
                        {tasa(fila.pctShow)}
                        <BarraDeTasa valor={fila.pctShow} />
                      </Celda>
                    </td>
                    <td className="text-right">
                      <Celda titulo={`Cierres de ${quien}`} detalle={c?.cierres}>
                        {num(fila.cierres)}
                      </Celda>
                    </td>
                    <td className="text-right">
                      <Celda titulo={`Grupo con show de ${quien}`} detalle={c?.grupo_shows}>
                        {tasa(fila.pctCierre)}
                        <BarraDeTasa valor={fila.pctCierre} />
                      </Celda>
                    </td>
                    <td className="text-right">
                      <Celda titulo={`Entró a caja por ${quien}`} detalle={c?.caja}>
                        <Caja caja={fila.caja} />
                      </Celda>
                    </td>
                    <td
                      className="text-right"
                      title={fila.ventasSinComision > 0 ? motivoSinComision : undefined}
                    >
                      {fila.comisionUsd === 0 && fila.ventasSinComision > 0 ? "—" : usd(fila.comisionUsd)}
                    </td>
                  </tr>
                );
              })}
            </Tabla>
          </div>
        )}
        <ComoSeCalcula>
          <p>
            Agendas y show se atribuyen a quien tomó la llamada. Los porcentajes usan el grupo de citas; cada deal
            cuenta en el closer de su último show o, sin show, de su última cita.
          </p>
          <p>
            Cierres y comisión usan el dueño actual del deal. Entró a caja usa quien registró el abono. Sin closer
            reúne lo que no tiene closer.
          </p>
          <p>{textoComisionPrograma(vista.comisionPorcentaje)}</p>
        </ComoSeCalcula>
      </CardContent>
    </Card>
  );
}

function AgendasPorSemana({
  semanas,
  proximas,
  contexto,
}: Pick<DetallesDeOperacion, "semanas" | "proximas"> & { contexto: string }) {
  const semanasConDatos = semanas.filter(
    (semana) =>
      semana.shows.resumen.subtotal.cantidad +
        semana.noShows.resumen.subtotal.cantidad +
        semana.pendientes.resumen.subtotal.cantidad >
      0,
  );
  if (semanasConDatos.length === 0 && proximas.length === 0) return null;
  const nombreSemana = (s: { desde: string; hasta: string }) =>
    s.desde === s.hasta ? fecha(s.desde) : `${fecha(s.desde)} a ${fecha(s.hasta)}`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">¿Qué pasó con las agendas de cada semana?</CardTitle>
        <ContextoDeCifra texto={contexto} />
      </CardHeader>
      <CardContent className="space-y-4">
        {semanasConDatos.length > 0 ? <LeyendaDeBarras items={LEYENDA_DE_AGENDAS} /> : null}
        {semanasConDatos.map((s) => (
          <div key={s.semana.desde} className="flex items-center gap-3">
            <span className="w-36 shrink-0 text-sm">{nombreSemana(s.semana)}</span>
            <div className="min-w-0 flex-1">
              <BarraApilada100
                segmentos={[
                  {
                    clave: "show",
                    etiqueta: "Show",
                    cantidad: s.shows.resumen.subtotal.cantidad,
                    detalle: s.shows,
                    tono: "exito",
                  },
                  {
                    clave: "no_show",
                    etiqueta: "No-show",
                    cantidad: s.noShows.resumen.subtotal.cantidad,
                    detalle: s.noShows,
                    tono: "peligro",
                  },
                  {
                    clave: "pendientes",
                    etiqueta: "Pendientes",
                    cantidad: s.pendientes.resumen.subtotal.cantidad,
                    detalle: s.pendientes,
                    tono: "alerta",
                  },
                ]}
              />
            </div>
          </div>
        ))}
        {proximas.length > 0 ? (
          <p className="text-sm text-muted-foreground">
            Próximas agendas:{" "}
            {proximas.map((p, i) => (
              <span key={p.semana.desde}>
                {i > 0 ? " · " : ""}
                <Celda titulo={`Agendas futuras · ${nombreSemana(p.semana)}`} detalle={p.futuras}>
                  {num(p.futuras.resumen.subtotal.cantidad)}
                </Celda>{" "}
                <span className="text-xs">({nombreSemana(p.semana)})</span>
              </span>
            ))}
          </p>
        ) : null}
        <ComoSeCalcula>
          <p>
            Semanas de lunes a domingo en Bogotá, recortadas al rango; del programa entero, sin filtro de closer. Show,
            no-show y pendientes usan el día de la cita ya pasada.
          </p>
          <p>
            Las próximas siguen agendadas y aún no llegan: son agenda, no resultado, y no dependen del periodo
            elegido.
          </p>
        </ComoSeCalcula>
      </CardContent>
    </Card>
  );
}

function EmbudoPorEtapas({
  vista,
  detalles,
  contexto,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDeOperacion["embudo"];
  contexto: string;
}) {
  const conversion = vista.embudoEtapas.conversion.todas;
  const pasosConDatos = conversion.pasos.filter((paso) => paso.llegaron > 0);
  const tiemposConDatos = vista.embudoEtapas.tiempoEnEtapa.filter(
    (fila): fila is typeof fila & { promedioDias: number } => fila.promedioDias !== null,
  );
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">¿En qué etapa se quedan y cuánto tardan?</CardTitle>
        <ContextoDeCifra texto={contexto} />
      </CardHeader>
      <CardContent className="space-y-5">
        {pasosConDatos.length > 0 ? <LeyendaDeBarras items={LEYENDA_DE_ETAPAS} /> : null}
        {pasosConDatos.map((paso) => {
          const indice = conversion.pasos.indexOf(paso);
          const siguiente = conversion.pasos[indice + 1];
          return (
            <div key={paso.paso} className="space-y-2">
              <p className="text-sm font-medium">
                {paso.paso === "vendido" ? "Vendido" : nombreDeEtapa(paso.paso)} ·{" "}
                <span className="cifra">{num(paso.llegaron)}</span> llegaron
              </p>
              <BarraApilada100
                segmentos={[
                  {
                    clave: "pasaron",
                    etiqueta: "Pasaron",
                    cantidad: paso.pasaron,
                    detalle: siguiente ? detalles?.pasos[siguiente.paso] : undefined,
                    tono: "exito",
                  },
                  {
                    clave: "siguen",
                    etiqueta: "Siguen aquí",
                    cantidad: paso.siguenAqui,
                    detalle: detalles?.siguen[paso.paso],
                    tono: "alerta",
                  },
                  {
                    clave: "perdidos",
                    etiqueta: "Se perdieron aquí",
                    cantidad: paso.perdidosAqui,
                    detalle: detalles?.perdidos[paso.paso],
                    tono: "peligro",
                  },
                  ...(paso.otros > 0
                    ? [
                        {
                          clave: "otros",
                          etiqueta: "Otro camino",
                          cantidad: paso.otros,
                          detalle: detalles?.otros[paso.paso],
                          tono: "info" as const,
                        },
                      ]
                    : []),
                ]}
              />
            </div>
          );
        })}
        <BarrasHorizontales
          filas={tiemposConDatos.map((fila) => ({
            clave: fila.etapa,
            etiqueta: nombreDeEtapa(fila.etapa),
            valor: fila.promedioDias,
            texto: `${num(fila.promedioDias, 1)} días`,
            detalle: detalles?.tiempo[fila.etapa],
          }))}
        />
        <ComoSeCalcula>
          <p>
            Pasaron son quienes llegaron al paso siguiente; siguen aquí son los abiertos cuya etapa actual es esta; se
            perdieron aquí llegaron a Cierre perdido desde esta etapa. “Otro camino” se muestra cuando esas tres
            salidas no explican a todos, por ejemplo por un salto.
          </p>
          <p>{REGLA_TIEMPO_EN_ETAPA}</p>
        </ComoSeCalcula>
      </CardContent>
    </Card>
  );
}

function DetalleAuditoria({
  vista,
  detalles,
  veEquipo,
  contexto,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDeOperacion["embudo"];
  veEquipo: boolean;
  contexto: string;
}) {
  return (
    <details className="rounded-lg border">
      <summary className="cursor-pointer px-4 py-3 text-base font-semibold">Detalle</summary>
      <div className="space-y-4 p-4 pt-0">
        <div className="grid gap-4 lg:grid-cols-2">
          {veEquipo ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Abiertos por etapa y owner</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabla cabeceras={["Etapa", "Owner", "Deals"]}>
                  {vista.embudoEtapas.abiertos.map((fila) => (
                    <tr key={`${fila.etapa}:${fila.ownerUserId ?? "sin"}`}>
                      <td>{nombreDeEtapa(fila.etapa)}</td>
                      <td>{fila.ownerNombre ?? "Sin dueño"}</td>
                      <td className="text-right">
                        <Celda
                          titulo={`Abiertos en ${nombreDeEtapa(fila.etapa)}`}
                          detalle={detalles?.abiertos[claveDeAbiertos(fila.etapa, fila.ownerUserId)]}
                        >
                          {num(fila.deals)}
                        </Celda>
                      </td>
                    </tr>
                  ))}
                </Tabla>
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sin dueño por antigüedad</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabla cabeceras={["Días", "Deals"]}>
                {vista.embudoEtapas.sinDuenoPorAntiguedad.map((fila) => (
                  <tr key={fila.bucket}>
                    <td>{fila.bucket}</td>
                    <td className="text-right">
                      <Celda titulo={`Sin dueño, ${fila.bucket} días`} detalle={detalles?.sinDueno[fila.bucket]}>
                        {num(fila.deals)}
                      </Celda>
                    </td>
                  </tr>
                ))}
              </Tabla>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Motivos de pérdida</CardTitle>
            <ContextoDeCifra texto={contexto} />
          </CardHeader>
          <CardContent>
            {vista.embudoEtapas.motivosDePerdida.length === 0 ? (
              <p className="text-sm text-muted-foreground">Ningún deal perdido con motivo en este rango.</p>
            ) : (
              <Tabla cabeceras={["Motivo", "Deals", "Ticket estimado"]}>
                {vista.embudoEtapas.motivosDePerdida.map((m) => (
                  <tr key={m.motivo}>
                    <td>{m.motivo}</td>
                    <td className="text-right">{num(m.deals)}</td>
                    <td className="text-right">{usd(m.ticketPerdidoUsd)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </CardContent>
        </Card>
      </div>
    </details>
  );
}

function Kpi({
  titulo,
  valor,
  base,
  detalle,
  anterior,
  periodo,
}: {
  titulo: string;
  valor: string;
  base: string;
  detalle?: DetalleDeCifra;
  anterior?: { actual: number; previo: number };
  periodo: VistaDelDashboard["periodo"];
}) {
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-xs text-muted-foreground">{titulo}</p>
        <p className="text-2xl font-semibold">
          <Celda titulo={titulo} detalle={detalle}>
            {valor}
          </Celda>
        </p>
        <p className="text-xs text-muted-foreground">{base}</p>
        {anterior ? (
          <p className="text-xs">
            Variación: <Variacion actual={anterior.actual} anterior={anterior.previo} periodo={periodo} />
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function Operacion({
  vista,
  detalles,
  detallesOperacion,
  dealsContraAgendas,
  escalera,
  dealsContraAgendasVista,
  detalleRegistros,
  hoy,
  veEquipo = true,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  veEquipo?: boolean;
  detallesOperacion?: DetallesDeOperacion;
  dealsContraAgendas: ReactNode;
  escalera?: ReactNode;
  dealsContraAgendasVista?: VistaDealsContraAgendas;
  detalleRegistros?: DetalleDeCifra;
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
  const contextoPrograma = contextoDeCifra({
    cohorte: vista.filtroDeCohorte.elegida?.codigo ?? null,
    rango: vista.seleccion.rango,
    hoy,
    closer: null,
  });
  const conVista = dealsContraAgendasVista?.disponible ? dealsContraAgendasVista : null;
  const finalA = conVista?.a.puntos.at(-1);
  const completoA = conVista?.porOrigen.completo.a.puntos.at(-1);
  const registros = detalleRegistros?.resumen.disponible ? detalleRegistros.resumen.subtotal.cantidad : null;
  const pasos = [
    ...(!vista.claveCloser && registros !== null
      ? [{ clave: "registros", etiqueta: nombreCorto("registros"), cantidad: registros, detalle: detalleRegistros }]
      : []),
    ...(!vista.claveCloser && conVista
      ? [
          {
            clave: "deals",
            etiqueta: "Deals creados",
            cantidad: finalA?.deals ?? 0,
            detalle: conVista.detalles.deals_creados,
          },
        ]
      : []),
    {
      clave: "agendas",
      etiqueta: nombreCorto("agendadas"),
      cantidad: vista.embudo.agendas,
      detalle: detalles?.agendas,
      pctDelPaso: completoA?.pctAgendaron == null ? null : completoA.pctAgendaron,
      etiquetaDelPct: "de los deals completos agendó",
    },
    {
      clave: "shows",
      etiqueta: nombreCorto("shows"),
      cantidad: vista.embudo.llamadasConShow,
      detalle: detalles?.shows,
      pctDelPaso: grupo.deals === 0 ? null : grupo.conShow / grupo.deals,
      perdidos: { cantidad: grupo.deals - grupo.conShow, detalle: detalles?.grupo_sin_show },
    },
    {
      clave: "ventas",
      etiqueta: nombreCorto("ventas"),
      cantidad: vista.embudo.cierres,
      detalle: detalles?.cierres,
      pctDelPaso: grupo.conShow === 0 ? null : grupo.vendidos / grupo.conShow,
    },
  ];
  return (
    <section id="operacion" className="scroll-mt-4 space-y-4">
      <h2 className="text-xl font-semibold">Operación comercial</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          titulo={nombreCorto("agendadas")}
          valor={num(vista.embudo.agendas)}
          base={`${
            completoA?.pctAgendaron == null ? "—" : pct(completoA.pctAgendaron)
          } de los deals completos agendó`}
          detalle={detalles?.agendas}
          anterior={anterior ? { actual: vista.embudo.agendas, previo: anterior.agendas } : undefined}
          periodo={vista.periodo}
        />
        <Kpi
          titulo="% show"
          valor={tasa(vista.embudo.pctShow)}
          base={`${num(grupo.conShow)} de ${num(grupo.deals)}`}
          detalle={detalles?.grupo_citas}
          anterior={
            anterior && vista.embudo.pctShow !== null && anterior.pctShow !== null
              ? { actual: vista.embudo.pctShow * 100, previo: anterior.pctShow * 100 }
              : undefined
          }
          periodo={vista.periodo}
        />
        <Kpi
          titulo="% cierre"
          valor={tasa(vista.embudo.pctCierre)}
          base={`${num(grupo.vendidos)} de ${num(grupo.conShow)}`}
          detalle={detalles?.grupo_shows}
          anterior={
            anterior && vista.embudo.pctCierre !== null && anterior.pctCierre !== null
              ? { actual: vista.embudo.pctCierre * 100, previo: anterior.pctCierre * 100 }
              : undefined
          }
          periodo={vista.periodo}
        />
        <Kpi
          titulo="Agenda → venta"
          valor={tasa(vista.embudo.agendaAVenta)}
          base={`${num(grupo.vendidos)} de ${num(grupo.deals)}`}
          detalle={detalles?.grupo_citas}
          anterior={
            anterior && vista.embudo.agendaAVenta !== null && anterior.agendaAVenta !== null
              ? { actual: vista.embudo.agendaAVenta * 100, previo: anterior.agendaAVenta * 100 }
              : undefined
          }
          periodo={vista.periodo}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">¿Dónde se pierden los deals?</CardTitle>
          <ContextoDeCifra texto={contexto} />
        </CardHeader>
        <CardContent className="space-y-4">
          {vista.claveCloser ? (
            <p className="text-sm text-muted-foreground">
              Con un closer elegido, el embudo empieza en Agendadas: registros y deals nacen del formulario.
            </p>
          ) : null}
          <EmbudoDeBarras pasos={pasos} />
          <div className="flex flex-wrap gap-2">
            {vista.embudo.pendientesDeResultado > 0 ? (
              <Badge variant="alerta">
                <Celda titulo="Citas pasadas sin resultado" detalle={detalles?.grupo_pendientes}>
                  {num(vista.embudo.pendientesDeResultado)}
                </Celda>{" "}
                sin resultado
              </Badge>
            ) : null}
            {vista.embudo.madurando ? <Badge variant="info">Aún madurando</Badge> : null}
          </div>
          <ComoSeCalcula>
            <p>
              Agendadas mide los deals de un formulario completo que agendaron; los parciales tienen su tasa aparte.
              Shows y ventas usan el mismo grupo de citas ocurridas.
            </p>
            <p>Las citas pasadas sin resultado quedan fuera de las tasas hasta que el closer registre qué pasó.</p>
          </ComoSeCalcula>
        </CardContent>
      </Card>
      {escalera}
      {dealsContraAgendas}
      {veEquipo ? (
        <Comparativo vista={vista} detalles={detallesOperacion?.comparativo} contexto={contextoPrograma} />
      ) : null}
      <EmbudoPorEtapas vista={vista} detalles={detallesOperacion?.embudo} contexto={contexto} />
      {detallesOperacion ? (
        <AgendasPorSemana
          semanas={detallesOperacion.semanas}
          proximas={detallesOperacion.proximas}
          contexto={contextoPrograma}
        />
      ) : null}
      <DetalleAuditoria vista={vista} detalles={detallesOperacion?.embudo} veEquipo={veEquipo} contexto={contexto} />
    </section>
  );
}
