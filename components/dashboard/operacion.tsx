import Link from "next/link";
import type { ReactNode } from "react";
import { CifraConLista } from "@/components/cifra-con-lista";
import { ContextoDeCifra } from "@/components/dashboard/contexto-de-cifra";
import { BarraDeCierre, DetalleDeEscalera, Escalera } from "@/components/dashboard/escalera";
import { BarraApilada100, EmbudoDeBarras, LeyendaDeBarras } from "@/components/graficas/barras";
import { EnlaceAInfo } from "@/components/hub/info-de-pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct, usd } from "@/lib/format";
import { ETIQUETA_CRITERIO_DE_CLOSER } from "@/lib/criterios-de-closer";
import { contextoDeCifra } from "@/lib/contexto-de-cifra";
import type { DineroDeVentas } from "@/lib/queries/dinero-de-ventas";
import type { OrigenEmbudoComercial, PasoDelEmbudoComercial } from "@/lib/queries/embudo-comercial";
import type { EtapaDelCamino } from "@/lib/queries/embudo-etapas";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { VistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import type { VistaDeEscalera } from "@/lib/queries/vista-escalera";
import {
  claveDeAbiertos,
  nombreDeEtapa,
  type DetalleDeCifra,
  type DetallesDeOperacion,
  type DetallesDelDashboard,
} from "@/lib/queries/vista-metrica";
import { Caja, Tabla } from "@/components/dashboard/piezas";
import { nombreCorto, nombreLargo } from "@/lib/vocabulario-metricas";
import { CifraDeRazon } from "@/components/cifra-de-razon";
import { valorDeRazon } from "@/lib/cobertura";

const formatearTasa = (valor: number | null) => valor === null ? "—" : pct(valor);

const ETIQUETA_DEL_PASO: Record<PasoDelEmbudoComercial["paso"], string> = {
  creados: "Deals creados",
  agendaron: "Agendaron",
  tuvieron_show: "Tuvieron show",
  compraron: "Compraron",
};

const ETIQUETA_DE_ETAPA: Record<EtapaDelCamino, string> = {
  en_gestion: "En gestión",
  contactado: "Contactado",
  calificado: "Calificado",
  agendado: "Agendado",
  atendido: "Atendido",
  compromiso_verbal: "Compromiso",
  ganado: "Ganado",
};

const LEYENDA_DE_ETAPAS = [
  { etiqueta: "Pasaron", tono: "exito" },
  { etiqueta: "Siguen aquí", tono: "alerta" },
  { etiqueta: "Se perdieron aquí", tono: "peligro" },
] as const;

const LEYENDA_DE_AGENDAS = [
  { etiqueta: "Realizadas", tono: "exito" },
  { etiqueta: "No asistió", tono: "peligro" },
  { etiqueta: "Sin marcar", tono: "alerta" },
  { etiqueta: "Futuras", tono: "info" },
] as const;

export function textoComisionPrograma(comisionPorcentaje: string | null): string {
  return comisionPorcentaje != null
    ? `Comisión: ${num(Number(comisionPorcentaje), 2)} % del valor vendido de cada venta, congelado al vender.`
    : "Comisión: sin porcentaje cargado.";
}

/** Comparativo compacto que Hoy conserva; Comercial reúne estas cifras en su tabla de closers. */
export function Comparativo({ vista, detalles, titulo = "¿Cómo va cada closer?" }: { vista: VistaDelDashboard; detalles?: DetallesDeOperacion["comparativo"]; titulo?: string; contexto?: string }) {
  return <Card><CardHeader><CardTitle className="text-base">{titulo}</CardTitle><p className="text-xs text-muted-foreground">Citas y realizadas {ETIQUETA_CRITERIO_DE_CLOSER.quien_tomo_la_llamada}; ventas y comisión {ETIQUETA_CRITERIO_DE_CLOSER.dueno_del_deal}; lo que entró a caja {ETIQUETA_CRITERIO_DE_CLOSER.quien_registro_el_abono}.</p></CardHeader><CardContent>
    {vista.comparativo.length === 0 ? <p className="text-sm text-muted-foreground">Nadie registró actividad en este rango.</p> : <div className="overflow-x-auto"><Tabla cabeceras={["Closer", nombreCorto("citas"), nombreCorto("asistencia"), nombreCorto("ventas"), nombreCorto("cierre_de_ventas"), nombreCorto("entro_a_caja")] }>
      {vista.comparativo.map((fila) => {
        const c = detalles?.[fila.clave];
        return <tr key={fila.clave}><td className="py-2">{fila.closerId ?? "Sin closer"}</td><td className="cifra text-right"><Celda titulo={nombreLargo("citas")} detalle={c?.agendas}>{num(fila.agendas)}</Celda></td><td className="cifra text-right"><Celda titulo={nombreLargo("asistencia")} detalle={c?.grupo_citas}><CifraDeRazon razon={fila.razonShow} formato={pct} /></Celda></td><td className="cifra text-right"><Celda titulo={nombreLargo("ventas")} detalle={c?.cierres}>{num(fila.cierres)}</Celda></td><td className="cifra text-right"><Celda titulo={nombreLargo("cierre_de_ventas")} detalle={c?.grupo_shows}><CifraDeRazon razon={fila.razonCierre} formato={pct} /></Celda></td><td className="cifra text-right"><Celda titulo={nombreLargo("entro_a_caja")} detalle={c?.caja}><Caja caja={fila.caja} /></Celda></td></tr>;
      })}
    </Tabla></div>}
  </CardContent></Card>;
}

function Titulo({ id, children }: { id: string; children: string }) {
  return <CardTitle className="flex items-center gap-1.5 text-base">{children}<EnlaceAInfo seccion={id} etiqueta={children} /></CardTitle>;
}

function Celda({ titulo, detalle, children }: { titulo: string; detalle?: DetalleDeCifra | null; children: ReactNode }) {
  return <CifraConLista titulo={titulo} detalle={detalle ?? undefined}>{children}</CifraConLista>;
}

function Kpi({ titulo, valor, base, detalle, parcial = false, cobertura }: { titulo: string; valor: string; base?: string; detalle?: DetalleDeCifra; parcial?: boolean; cobertura?: string }) {
  return <Card><CardContent className="space-y-1 pt-4">
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{titulo}</p>{parcial ? <Badge variant="alerta" title={cobertura} aria-label={cobertura}>parcial</Badge> : null}</div>
    <p className="cifra text-2xl font-semibold"><Celda titulo={titulo} detalle={detalle}>{valor}</Celda></p>
    {base ? <p className="cifra text-xs text-muted-foreground">{base}</p> : null}
  </CardContent></Card>;
}

function AgendasPorSemana({ semanas, proximas }: Pick<DetallesDeOperacion, "semanas" | "proximas">) {
  const filas = new Map<string, { desde: string; hasta: string; shows?: DetalleDeCifra; noShows?: DetalleDeCifra; pendientes?: DetalleDeCifra; futuras?: DetalleDeCifra }>();
  for (const s of semanas) filas.set(s.semana.desde, { ...s.semana, shows: s.shows, noShows: s.noShows, pendientes: s.pendientes });
  for (const p of proximas) filas.set(p.semana.desde, { ...(filas.get(p.semana.desde) ?? p.semana), futuras: p.futuras });
  const cantidad = (d?: DetalleDeCifra) => d?.resumen.subtotal.cantidad ?? 0;
  const conCasos = [...filas.values()].filter((s) => cantidad(s.shows) + cantidad(s.noShows) + cantidad(s.pendientes) + cantidad(s.futuras) > 0);
  const titulo = "Citas por semana";
  return <Card><CardHeader><Titulo id="agendas-semana">{titulo}</Titulo></CardHeader><CardContent className="space-y-4">
    {conCasos.length === 0 ? <p className="text-sm text-muted-foreground">Sin citas en el periodo.</p> : <LeyendaDeBarras items={LEYENDA_DE_AGENDAS} />}
    {conCasos.map((s) => <div key={s.desde} className="space-y-1.5">
      <p className="text-sm font-medium">{fecha(s.desde)} a {fecha(s.hasta)}</p>
      <BarraApilada100 segmentos={[
        { clave: "show", etiqueta: "Realizadas", cantidad: cantidad(s.shows), detalle: s.shows, tono: "exito" },
        { clave: "no_show", etiqueta: "No asistió", cantidad: cantidad(s.noShows), detalle: s.noShows, tono: "peligro" },
        { clave: "sin_marcar", etiqueta: "Sin marcar", cantidad: cantidad(s.pendientes), detalle: s.pendientes, tono: "alerta" },
        { clave: "futuras", etiqueta: "Futuras", cantidad: cantidad(s.futuras), detalle: s.futuras, tono: "info" },
      ]} />
    </div>)}
  </CardContent></Card>;
}

function Caminos({ vista, detalles }: { vista: VistaDelDashboard; detalles?: DetallesDeOperacion["embudo"] }) {
  const titulo = "¿Dónde se quedan y cuánto tardan?";
  const tiempo = new Map(vista.embudoEtapas.tiempoEnEtapa.map((fila) => [fila.etapa, fila.medianaDiasHabiles]));
  const detalle = (grupo: "pasos" | "siguen" | "perdidos", etapa: EtapaDelCamino) => detalles?.[grupo][etapa];
  return <Card><CardHeader><Titulo id="etapas">{titulo}</Titulo></CardHeader><CardContent className="space-y-6">
    <LeyendaDeBarras items={LEYENDA_DE_ETAPAS} />
    {vista.embudoEtapas.conversion.porCamino.map((camino) => <section key={camino.camino} className="space-y-3">
      <h3 className="font-medium">{camino.camino === "setter" ? "Camino del setter" : "Camino de la llamada"}</h3>
      {camino.pasos.map((paso, indice) => {
        const mediana = tiempo.get(paso.etapa === "ganado" ? "ganado_parcial" : paso.etapa) ?? null;
        const siguiente = camino.pasos[indice + 1]?.etapa;
        return <div key={paso.etapa} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3"><p className="text-sm">{ETIQUETA_DE_ETAPA[paso.etapa]}</p><p className="cifra text-xs text-muted-foreground">{mediana === null ? "—" : `${num(mediana, mediana % 1 === 0 ? 0 : 1)} días hábiles`}</p></div>
          <BarraApilada100 segmentos={[
            { clave: "pasaron", etiqueta: "Pasaron", cantidad: paso.pasaron, detalle: siguiente ? detalle("pasos", siguiente) : undefined, tono: "exito" },
            { clave: "siguen", etiqueta: "Siguen aquí", cantidad: paso.siguenAqui, detalle: detalle("siguen", paso.etapa), tono: "alerta" },
            { clave: "perdidos", etiqueta: "Se perdieron aquí", cantidad: paso.perdidosAqui, detalle: detalle("perdidos", paso.etapa), tono: "peligro" },
          ]} />
        </div>;
      })}
    </section>)}
  </CardContent></Card>;
}

function Closers({ vista, detalles, escalera, dinero }: { vista: VistaDelDashboard; detalles?: DetallesDeOperacion["comparativo"]; escalera: VistaDeEscalera; dinero: Record<string, DineroDeVentas> }) {
  const titulo = "Closers";
  if (vista.comparativo.length === 0) return null;
  return <Card><CardHeader><Titulo id="closers">{titulo}</Titulo></CardHeader><CardContent className="overflow-x-auto">
    <Tabla cabeceras={["Closer", nombreCorto("citas"), nombreCorto("asistencia"), nombreCorto("cierre_de_ventas"), "Cita → venta", "Cómo vendió", "Sin marcar", "Vendido", "Recaudado", "Por cobrar"]}>
      {vista.comparativo.map((fila) => {
        const c = detalles?.[fila.clave];
        const e = escalera.porCloser.find((x) => x.clave === fila.clave);
        const d = dinero[fila.clave];
        const base = fila.grupo.deals + fila.grupo.sinMarcar;
        const tasa = (valor: number | null) => valor === null ? "—" : formatearTasa(valor);
        return <tr key={fila.clave}>
          <td className="py-2">{fila.closerId ?? "Sin closer"}</td>
          <td className="cifra text-right"><Celda titulo={nombreLargo("citas")} detalle={c?.agendas}>{fila.agendas ? num(fila.agendas) : "—"}</Celda></td>
          <td className="cifra text-right"><Celda titulo="Grupo de citas" detalle={c?.grupo_citas}><CifraDeRazon razon={fila.razonShow} formato={pct} /></Celda></td>
          <td className="cifra text-right"><Celda titulo={nombreLargo("cierre_de_ventas")} detalle={c?.grupo_shows}><CifraDeRazon razon={fila.razonCierre} formato={pct} /></Celda></td>
          <td className="cifra text-right">{tasa(fila.agendaAVenta)}</td>
          <td className="w-56 min-w-44 px-4 text-right">{e ? <BarraDeCierre fila={e} /> : "—"}</td>
          <td className="cifra text-right"><Celda titulo="Citas sin marcar" detalle={c?.grupo_pendientes}>{fila.grupo.sinMarcar ? num(fila.grupo.sinMarcar) : "—"}</Celda>{fila.grupo.parcial ? <Badge className="ml-2" variant="alerta" title={`Calculado sobre ${num(fila.grupo.deals)} de ${num(base)} citas: ${num(fila.grupo.sinMarcar)} sin marcar`} aria-label={`Calculado sobre ${num(fila.grupo.deals)} de ${num(base)} citas: ${num(fila.grupo.sinMarcar)} sin marcar`}>parcial</Badge> : null}</td>
          {([["Vendido", d?.vendido], ["Recaudado", d?.recaudado], ["Por cobrar", d?.porCobrar]] as const).map(([nombre, valor]) => (
            <td key={nombre} className="cifra whitespace-nowrap pl-4 text-right">
              <Celda titulo={`${nombre} del closer`} detalle={c?.cierres}>{d && d.ventas > 0 && valor !== undefined ? usd(valor) : "—"}</Celda>
            </td>
          ))}
        </tr>;
      })}
    </Tabla>
  </CardContent></Card>;
}

function DetalleAuditoria({ vista, detalles, veEquipo, escalera }: { vista: VistaDelDashboard; detalles?: DetallesDeOperacion["embudo"]; veEquipo: boolean; escalera?: VistaDeEscalera }) {
  return <details className="auditoria-comercial rounded-lg border">
    <summary className="cursor-pointer px-4 py-3 text-base font-semibold">Detalle de auditoría</summary>
    <div className="space-y-4 p-4 pt-0">
      <div className="grid gap-4 lg:grid-cols-2">
        {veEquipo ? <Card><CardHeader><CardTitle className="text-base">Abiertos por owner</CardTitle></CardHeader><CardContent><Tabla cabeceras={["Etapa", "Owner", "Deals"]}>{vista.embudoEtapas.abiertos.map((fila) => <tr key={`${fila.etapa}:${fila.ownerUserId ?? "sin"}`}><td>{nombreDeEtapa(fila.etapa)}</td><td>{fila.ownerNombre ?? "Sin dueño"}</td><td className="cifra text-right"><Celda titulo="Deals abiertos" detalle={detalles?.abiertos[claveDeAbiertos(fila.etapa, fila.ownerUserId)]}>{num(fila.deals)}</Celda></td></tr>)}</Tabla></CardContent></Card> : null}
        <Card><CardHeader><CardTitle className="text-base">Sin dueño</CardTitle></CardHeader><CardContent><Tabla cabeceras={["Días", "Deals"]}>{vista.embudoEtapas.sinDuenoPorAntiguedad.map((fila) => <tr key={fila.bucket}><td>{fila.bucket}</td><td className="cifra text-right"><Celda titulo="Deals sin dueño" detalle={detalles?.sinDueno[fila.bucket]}>{num(fila.deals)}</Celda></td></tr>)}</Tabla></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Motivos de pérdida</CardTitle></CardHeader><CardContent>{vista.embudoEtapas.motivosDePerdida.length === 0 ? <p className="text-sm text-muted-foreground">Sin motivos en este periodo.</p> : <Tabla cabeceras={["Motivo", "Deals", "Ticket estimado"]}>{vista.embudoEtapas.motivosDePerdida.map((m) => <tr key={m.motivo}><td>{m.motivo}</td><td className="cifra text-right">{num(m.deals)}</td><td className="cifra text-right">{usd(m.ticketPerdidoUsd)}</td></tr>)}</Tabla>}</CardContent></Card>
      {escalera ? <Card><CardHeader><CardTitle className="text-base">Siete escalones</CardTitle></CardHeader><CardContent><DetalleDeEscalera vista={escalera} periodo={vista.periodo} /></CardContent></Card> : null}
    </div>
  </details>;
}

export interface PasoComercialConDetalle extends PasoDelEmbudoComercial {
  detalle?: DetalleDeCifra;
  detallePerdidos?: DetalleDeCifra;
}

export function Operacion({
  vista, detalles, detallesOperacion, dealsContraAgendas, vistaEscalera,
  embudoComercial, origenEmbudo = "completo", enlacesDeOrigen, dineroPorCloser = {},
  hoy, veEquipo = true,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  detallesOperacion?: DetallesDeOperacion;
  dealsContraAgendas: ReactNode;
  vistaEscalera?: VistaDeEscalera;
  embudoComercial?: PasoComercialConDetalle[];
  origenEmbudo?: "todos" | OrigenEmbudoComercial;
  enlacesDeOrigen?: Record<"todos" | "completo" | "parcial", string>;
  dineroPorCloser?: Record<string, DineroDeVentas>;
  dealsContraAgendasVista?: VistaDealsContraAgendas;
  hoy: string;
  veEquipo?: boolean;
}) {
  const grupo = vista.embudo.grupo;
  const contexto = contextoDeCifra({ cohorte: vista.filtroDeCohorte.elegida?.codigo ?? null, rango: vista.seleccion.rango, hoy, closer: vista.closers.find((c) => c.id === vista.claveCloser)?.label ?? null });
  const totalCitas = grupo.deals + grupo.sinMarcar;
  const cobertura = `Calculado sobre ${num(grupo.deals)} de ${num(totalCitas)} citas: ${num(grupo.sinMarcar)} sin marcar`;
  const ventasSinLlamada = vistaEscalera?.principal.grupos.ventas_sin_llamada;
  const opciones = [{ clave: "todos", etiqueta: "Todos" }, { clave: "completo", etiqueta: "Formulario completo" }, { clave: "parcial", etiqueta: "Parcial" }] as const;
  return <section id="operacion" className="scroll-mt-4 space-y-4">
    <div><h2 className="text-xl font-semibold">Comercial</h2><ContextoDeCifra texto={contexto} /></div>
    <Card><CardHeader><Titulo id="cifras">Cifras clave</Titulo></CardHeader><CardContent className="space-y-3">
      {grupo.sinMarcar > 0 ? <Badge variant="alerta"><Celda titulo="Citas sin marcar" detalle={detalles?.grupo_pendientes}>{num(grupo.sinMarcar)} citas sin marcar</Celda></Badge> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi titulo={nombreCorto("citas")} valor={num(vista.embudo.agendas)} detalle={detalles?.agendas} />
        <Kpi titulo={nombreCorto("asistencia")} valor={valorDeRazon(vista.embudo.razonShow, pct)} base={`${num(grupo.conShow)} de ${num(grupo.deals)}`} detalle={detalles?.grupo_citas} parcial={grupo.parcial} cobertura={cobertura} />
        <Kpi titulo={nombreCorto("cierre_de_ventas")} valor={valorDeRazon(vista.embudo.razonCierre, pct)} base={`${num(grupo.vendidos)} de ${num(grupo.conShow)}`} detalle={detalles?.grupo_shows} parcial={grupo.parcial} cobertura={cobertura} />
        <Kpi titulo="Cita → venta" valor={formatearTasa(vista.embudo.agendaAVenta)} base={`${num(grupo.vendidos)} de ${num(grupo.deals)}`} detalle={detalles?.grupo_citas} />
      </div>
    </CardContent></Card>
    {embudoComercial ? <Card><CardHeader><Titulo id="embudo">¿Dónde se pierden?</Titulo></CardHeader><CardContent className="space-y-4">
      {enlacesDeOrigen ? <div className="flex flex-wrap gap-1" role="group" aria-label="Origen del deal">{opciones.map((opcion) => <Button key={opcion.clave} size="sm" variant={origenEmbudo === opcion.clave ? "default" : "outline"} nativeButton={false} render={<Link scroll={false} href={enlacesDeOrigen[opcion.clave]} />}>{opcion.etiqueta}</Button>)}</div> : null}
      <EmbudoDeBarras pasos={embudoComercial.map((paso, indice) => ({ clave: paso.paso, etiqueta: ETIQUETA_DEL_PASO[paso.paso], cantidad: paso.cantidad, detalle: paso.detalle, pctDelPaso: paso.pctDelPaso, perdidos: indice === 0 ? undefined : { cantidad: paso.perdidos, detalle: paso.detallePerdidos } }))} />
      {ventasSinLlamada && ventasSinLlamada.deals > 0 ? <p className="text-sm text-muted-foreground"><Celda titulo="Ventas sin llamada registrada" detalle={ventasSinLlamada.detalle}>{num(ventasSinLlamada.deals)}</Celda> ventas sin llamada registrada</p> : null}
    </CardContent></Card> : null}
    {vistaEscalera ? <Escalera vista={vistaEscalera} /> : null}
    {dealsContraAgendas}
    <Caminos vista={vista} detalles={detallesOperacion?.embudo} />
    {detallesOperacion ? <AgendasPorSemana semanas={detallesOperacion.semanas} proximas={detallesOperacion.proximas} /> : null}
    {veEquipo && vistaEscalera ? <Closers vista={vista} detalles={detallesOperacion?.comparativo} escalera={vistaEscalera} dinero={dineroPorCloser} /> : null}
    <DetalleAuditoria vista={vista} detalles={detallesOperacion?.embudo} veEquipo={veEquipo} escalera={vistaEscalera} />
  </section>;
}
