import { Enlace } from "@/components/enlace";
import type { ReactNode } from "react";
import type { cifrasClaveDeComercial, CifrasDeCloser } from "@/lib/hub/cifras-de-comercial";
import type { cifrasDeEscalera, cifrasDelEmbudoComercial, cifrasDeCaminos, cifrasDeCitasPorSemana, cifrasDeAuditoria } from "@/lib/hub/cifras-de-recorridos";
import type { CifraDeMetrica } from "@/lib/metricas/cifra";
import { Cifra, CifraConLista } from "@/components/cifra-con-lista";
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
import type {
  AreaEmbudoComercial,
  OrigenEmbudoComercial,
  PasoDelEmbudoComercial,
} from "@/lib/queries/embudo-comercial";
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
import { nombreCorto, nombreLargo, UNIVERSO_COMERCIAL } from "@/lib/vocabulario-metricas";
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

function Titulo({ id, children, sinInfo = false }: { id: string; children: string; sinInfo?: boolean }) {
  return <CardTitle className="flex items-center gap-1.5 text-base">{children}{sinInfo ? null : <EnlaceAInfo seccion={id} etiqueta={children} />}</CardTitle>;
}

function Celda({ titulo, detalle, children, cifra }: { titulo: string; detalle?: DetalleDeCifra | null; children: ReactNode; cifra?: CifraDeMetrica }) {
  if (cifra) return <Cifra cifra={cifra} tamano="celda">{children}</Cifra>;
  return <CifraConLista titulo={titulo} detalle={detalle ?? undefined}>{children}</CifraConLista>;
}

function Kpi({ titulo, valor, base, detalle, parcial = false, cobertura }: { titulo: string; valor: string; base?: string; detalle?: DetalleDeCifra; parcial?: boolean; cobertura?: string }) {
  return <Card><CardContent className="space-y-1 pt-4">
    <div className="flex items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{titulo}</p>{parcial ? <Badge variant="alerta" title={cobertura} aria-label={cobertura}>parcial</Badge> : null}</div>
    <p className="cifra text-2xl font-semibold"><Celda titulo={titulo} detalle={detalle}>{valor}</Celda></p>
    {base ? <p className="cifra text-xs text-muted-foreground">{base}</p> : null}
  </CardContent></Card>;
}

function AgendasPorSemana({ semanas, proximas, cifras }: Pick<DetallesDeOperacion, "semanas" | "proximas"> & { cifras?: CifrasDeComercial["semanas"] }) {
  const filas = new Map<string, { desde: string; hasta: string; shows?: DetalleDeCifra; noShows?: DetalleDeCifra; pendientes?: DetalleDeCifra; futuras?: DetalleDeCifra }>();
  for (const s of semanas) filas.set(s.semana.desde, { ...s.semana, shows: s.shows, noShows: s.noShows, pendientes: s.pendientes });
  for (const p of proximas) filas.set(p.semana.desde, { ...(filas.get(p.semana.desde) ?? p.semana), futuras: p.futuras });
  const cantidad = (d?: DetalleDeCifra) => d?.resumen.subtotal.cantidad ?? 0;
  const conCasos = [...filas.values()].filter((s) => cantidad(s.shows) + cantidad(s.noShows) + cantidad(s.pendientes) + cantidad(s.futuras) > 0);
  const titulo = "Citas por semana";
  return <Card><CardHeader><Titulo id="agendas-semana" sinInfo={!!cifras}>{titulo}</Titulo>{cifras ? <p className="text-xs text-muted-foreground">Las citas se agrupan por su semana y resultado: show, no-show, sin marcar o futura.</p> : null}</CardHeader><CardContent className="space-y-4">
    {conCasos.length === 0 ? <p className="text-sm text-muted-foreground">Sin citas en el periodo.</p> : <LeyendaDeBarras items={LEYENDA_DE_AGENDAS} />}
    {conCasos.map((s) => <div key={s.desde} className="space-y-1.5">
      <p className="text-sm font-medium">{fecha(s.desde)} a {fecha(s.hasta)}</p>
      <BarraApilada100 segmentos={[
        { clave: "show", etiqueta: "Realizadas", cantidad: cantidad(s.shows), cifra: cifras?.find((f) => f.desde === s.desde)?.realizadas, detalle: s.shows, tono: "exito" },
        { clave: "no_show", etiqueta: "No asistió", cantidad: cantidad(s.noShows), cifra: cifras?.find((f) => f.desde === s.desde)?.noAsistio, detalle: s.noShows, tono: "peligro" },
        { clave: "sin_marcar", etiqueta: "Sin marcar", cantidad: cantidad(s.pendientes), cifra: cifras?.find((f) => f.desde === s.desde)?.sinMarcar, detalle: s.pendientes, tono: "alerta" },
        { clave: "futuras", etiqueta: "Futuras", cantidad: cantidad(s.futuras), cifra: cifras?.find((f) => f.desde === s.desde)?.futuras, detalle: s.futuras, tono: "info" },
      ]} />
    </div>)}
  </CardContent></Card>;
}

function Caminos({ vista, detalles, cifras }: { vista: VistaDelDashboard; detalles?: DetallesDeOperacion["embudo"]; cifras?: CifrasDeComercial["caminos"] }) {
  const titulo = "¿Dónde se quedan y cuánto tardan?";
  const tiempo = new Map(vista.embudoEtapas.tiempoEnEtapa.map((fila) => [fila.etapa, fila.medianaDiasHabiles]));
  const detalle = (grupo: "pasos" | "siguen" | "perdidos", etapa: EtapaDelCamino) => detalles?.[grupo][etapa];
  return <Card><CardHeader><Titulo id="etapas" sinInfo={!!cifras}>{titulo}</Titulo>{cifras ? <p className="text-xs text-muted-foreground">Abiertos, aunque hayan vuelto a una etapa anterior. Se perdieron aquí: hoy en Cierre Perdido.</p> : null}</CardHeader><CardContent className="space-y-6">
    <LeyendaDeBarras items={LEYENDA_DE_ETAPAS} />
    {vista.embudoEtapas.conversion.porCamino.map((camino) => <section key={camino.camino} className="space-y-3">
      <h3 className="font-medium">{camino.camino === "setter" ? "Camino del setter" : "Camino de la llamada"}</h3>
      {camino.pasos.map((paso, indice) => {
        const c = cifras?.find((c) => c.camino === camino.camino)?.pasos.find((p) => p.etapa === paso.etapa);
        const mediana = tiempo.get(paso.etapa === "ganado" ? "ganado_parcial" : paso.etapa) ?? null;
        const siguiente = camino.pasos[indice + 1]?.etapa;
        return <div key={paso.etapa} className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3"><p className="text-sm">{ETIQUETA_DE_ETAPA[paso.etapa]}</p><p className="cifra text-xs text-muted-foreground">{c ? <Cifra cifra={c.diasMedianos} tamano="celda">{mediana === null ? "—" : `${num(mediana, mediana % 1 === 0 ? 0 : 1)} días hábiles`}</Cifra> : mediana === null ? "—" : `${num(mediana, mediana % 1 === 0 ? 0 : 1)} días hábiles`}</p></div>
          <BarraApilada100 segmentos={[
            { clave: "pasaron", etiqueta: "Pasaron", cantidad: paso.pasaron, cifra: c?.pasaron, detalle: siguiente ? detalle("pasos", siguiente) : undefined, tono: "exito" },
            { clave: "siguen", etiqueta: "Siguen aquí", cantidad: paso.siguenAqui, cifra: c?.siguen, detalle: detalle("siguen", paso.etapa), tono: "alerta" },
            { clave: "perdidos", etiqueta: "Se perdieron aquí", cantidad: paso.perdidosAqui, cifra: c?.perdidos, detalle: detalle("perdidos", paso.etapa), tono: "peligro" },
          ]} />
        </div>;
      })}
    </section>)}
  </CardContent></Card>;
}

function Closers({ vista, detalles, escalera, dinero, cifras, cifrasEscalera }: { cifras?: CifrasDeCloser[]; cifrasEscalera?: CifrasDeComercial["escalera"]; vista: VistaDelDashboard; detalles?: DetallesDeOperacion["comparativo"]; escalera: VistaDeEscalera; dinero: Record<string, DineroDeVentas> }) {
  const titulo = "Closers";
  if (vista.comparativo.length === 0) return null;
  return <Card><CardHeader><Titulo id="closers" sinInfo={!!cifras}>{titulo}</Titulo>{cifras ? <p className="text-xs text-muted-foreground">Las mismas cifras de arriba, por closer, en el periodo elegido. Sin casos sale “—”.</p> : null}</CardHeader><CardContent className="overflow-x-auto">
    <Tabla cabeceras={["Closer", nombreCorto("citas"), nombreCorto("asistencia"), nombreCorto("cierre_de_ventas"), nombreCorto("cita_a_venta"), "Cómo vendió", "Sin marcar", nombreCorto("vendido"), nombreCorto("recaudado"), nombreCorto("por_cobrar")]}>
      {vista.comparativo.map((fila) => {
        const c = detalles?.[fila.clave];
        const cifrasFila = cifras?.find((c) => c.clave === fila.clave);
        const e = escalera.porCloser.find((x) => x.clave === fila.clave);
        const d = dinero[fila.clave];
        const base = fila.grupo.deals + fila.grupo.sinMarcar;
        const tasa = (valor: number | null) => valor === null ? "—" : formatearTasa(valor);
        return <tr key={fila.clave}>
          <td className="py-2">{fila.closerId ?? "Sin closer"}</td>
          <td className="cifra text-right"><Celda cifra={cifrasFila?.citas} titulo={nombreLargo("citas")} detalle={c?.agendas}>{fila.agendas ? num(fila.agendas) : "—"}</Celda></td>
          <td className="cifra text-right"><Celda cifra={cifrasFila?.asistencia} titulo="Grupo de citas" detalle={c?.grupo_citas}><CifraDeRazon razon={fila.razonShow} formato={pct} /></Celda></td>
          <td className="cifra text-right"><Celda cifra={cifrasFila?.cierreDeVentas} titulo={nombreLargo("cierre_de_ventas")} detalle={c?.grupo_shows}><CifraDeRazon razon={fila.razonCierre} formato={pct} /></Celda></td>
          <td className="cifra text-right">{cifrasFila ? <Cifra cifra={cifrasFila.citaAVenta} tamano="celda" /> : tasa(fila.agendaAVenta)}</td>
          <td className="w-56 min-w-44 px-4 text-right">{e ? <BarraDeCierre fila={e} cifras={cifrasEscalera?.porCloser.find((c) => c.clave === fila.clave)} /> : "—"}</td>
          <td className="cifra text-right"><Celda cifra={cifrasFila?.sinMarcar ?? undefined} titulo="Citas sin marcar" detalle={c?.grupo_pendientes}>{fila.grupo.sinMarcar ? num(fila.grupo.sinMarcar) : "—"}</Celda>{fila.grupo.parcial ? <Badge className="ml-2" variant="alerta" title={`Calculado sobre ${num(fila.grupo.deals)} de ${num(base)} citas: ${num(fila.grupo.sinMarcar)} sin marcar`} aria-label={`Calculado sobre ${num(fila.grupo.deals)} de ${num(base)} citas: ${num(fila.grupo.sinMarcar)} sin marcar`}>parcial</Badge> : null}</td>
          {([["Vendido", d?.vendido, cifrasFila?.vendido], ["Recaudado", d?.recaudado, cifrasFila?.recaudado], ["Por cobrar", d?.porCobrar, cifrasFila?.porCobrar]] as const).map(([nombre, valor, cifra]) => (
            <td key={nombre} className="cifra whitespace-nowrap pl-4 text-right">
              <Celda cifra={cifra} titulo={`${nombre} del closer`} detalle={c?.cierres}>{d && d.ventas > 0 && valor !== undefined ? usd(valor) : "—"}</Celda>
            </td>
          ))}
        </tr>;
      })}
    </Tabla>
  </CardContent></Card>;
}

function DetalleAuditoria({ vista, detalles, veEquipo, escalera, cifras, cifrasEscalera }: { cifras?: CifrasDeComercial["auditoria"]; cifrasEscalera?: CifrasDeComercial["escalera"]; vista: VistaDelDashboard; detalles?: DetallesDeOperacion["embudo"]; veEquipo: boolean; escalera?: VistaDeEscalera }) {
  return <details className="auditoria-comercial rounded-lg border">
    <summary className="cursor-pointer px-4 py-3 text-base font-semibold">Detalle de auditoría</summary>
    <div className="space-y-4 p-4 pt-0">
      <div className="grid gap-4 lg:grid-cols-2">
        {veEquipo ? <Card><CardHeader><CardTitle className="text-base">Abiertos por owner</CardTitle></CardHeader><CardContent><Tabla cabeceras={["Etapa", "Owner", "Deals"]}>{vista.embudoEtapas.abiertos.map((fila, indice) => <tr key={`${fila.etapa}:${fila.ownerUserId ?? "sin"}`}><td>{nombreDeEtapa(fila.etapa)}</td><td>{fila.ownerNombre ?? "Sin dueño"}</td><td className="cifra text-right"><Celda cifra={cifras?.abiertos[indice]?.cifra} titulo="Deals abiertos" detalle={detalles?.abiertos[claveDeAbiertos(fila.etapa, fila.ownerUserId)]}>{num(fila.deals)}</Celda></td></tr>)}</Tabla></CardContent></Card> : null}
        <Card><CardHeader><CardTitle className="text-base">Sin dueño</CardTitle></CardHeader><CardContent><Tabla cabeceras={["Días", "Deals"]}>{vista.embudoEtapas.sinDuenoPorAntiguedad.map((fila) => <tr key={fila.bucket}><td>{fila.bucket}</td><td className="cifra text-right"><Celda cifra={cifras?.sinDueno.find((c) => c.antiguedad === fila.bucket)?.cifra} titulo="Deals sin dueño" detalle={detalles?.sinDueno[fila.bucket]}>{num(fila.deals)}</Celda></td></tr>)}</Tabla></CardContent></Card>
      </div>
      <Card><CardHeader><CardTitle className="text-base">Motivos de pérdida</CardTitle></CardHeader><CardContent>{vista.embudoEtapas.motivosDePerdida.length === 0 ? <p className="text-sm text-muted-foreground">Sin motivos en este periodo.</p> : <Tabla cabeceras={["Motivo", "Deals", "Ticket estimado"]}>{vista.embudoEtapas.motivosDePerdida.map((m) => <tr key={m.motivo}><td>{m.motivo}</td><td className="cifra text-right">{cifras ? <Cifra cifra={cifras.motivos.find((c) => c.motivo === m.motivo)!.deals} tamano="celda" /> : num(m.deals)}</td><td className="cifra text-right">{cifras ? <Cifra cifra={cifras.motivos.find((c) => c.motivo === m.motivo)!.ticket} tamano="celda" /> : usd(m.ticketPerdidoUsd)}</td></tr>)}</Tabla>}</CardContent></Card>
      {escalera ? <Card><CardHeader><CardTitle className="text-base">Siete escalones</CardTitle></CardHeader><CardContent><DetalleDeEscalera vista={escalera} periodo={vista.periodo} cifras={cifrasEscalera} /></CardContent></Card> : null}
    </div>
  </details>;
}

export interface PasoComercialConDetalle extends PasoDelEmbudoComercial {
  detalle?: DetalleDeCifra;
  detallePerdidos?: DetalleDeCifra;
}

export interface CifrasDeComercial {
  clave: ReturnType<typeof cifrasClaveDeComercial>;
  escalera: ReturnType<typeof cifrasDeEscalera>;
  embudo: ReturnType<typeof cifrasDelEmbudoComercial>;
  caminos: ReturnType<typeof cifrasDeCaminos>;
  semanas: ReturnType<typeof cifrasDeCitasPorSemana>;
  auditoria: ReturnType<typeof cifrasDeAuditoria>;
  closers?: CifrasDeCloser[];
}

export function Operacion({
  cifras,
  vista, detalles, detallesOperacion, dealsContraAgendas, vistaEscalera,
  embudoComercial, origenEmbudo = "completo", enlacesDeOrigen,
  areaEmbudo = "todas", enlacesDeArea, dineroPorCloser = {},
  hoy, veEquipo = true,
}: {
  cifras?: CifrasDeComercial;
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  detallesOperacion?: DetallesDeOperacion;
  dealsContraAgendas: ReactNode;
  vistaEscalera?: VistaDeEscalera;
  embudoComercial?: PasoComercialConDetalle[];
  origenEmbudo?: "todos" | OrigenEmbudoComercial;
  enlacesDeOrigen?: Record<"todos" | "completo" | "parcial", string>;
  areaEmbudo?: "todas" | AreaEmbudoComercial;
  enlacesDeArea?: Record<"todas" | AreaEmbudoComercial, string>;
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
  const embudoCortado = areaEmbudo !== "todas" || origenEmbudo !== "todos";
  const opcionesDeArea = [{ clave: "todas", etiqueta: "Todas" }, { clave: "paid", etiqueta: "Paid" }, { clave: "organico", etiqueta: "Orgánico" }, { clave: "referidos", etiqueta: "Referidos" }, { clave: "sin_utm", etiqueta: "Sin UTM" }] as const;
  return <section id="operacion" className="scroll-mt-4 space-y-4">
    <div><h2 className="text-xl font-semibold">Comercial</h2>{cifras ? null : <p className="text-xs text-muted-foreground">{UNIVERSO_COMERCIAL}</p>}<ContextoDeCifra texto={contexto} /></div>
    <Card><CardHeader><Titulo id="cifras" sinInfo={!!cifras}>Cifras clave</Titulo>{cifras ? <p className="text-xs text-muted-foreground">Citas creadas dentro del periodo. Más de 10 % sin marcar vuelve parcial la tasa. Esas citas nunca cuentan como no-show.</p> : null}</CardHeader><CardContent className="space-y-3">
      {cifras ? cifras.clave.sinMarcar ? <Badge variant="alerta"><Cifra cifra={cifras.clave.sinMarcar} tamano="celda" /> citas sin marcar</Badge> : null : grupo.sinMarcar > 0 ? <Badge variant="alerta"><Celda titulo="Citas sin marcar" detalle={detalles?.grupo_pendientes}>{num(grupo.sinMarcar)} citas sin marcar</Celda></Badge> : null}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cifras ? <>{[cifras.clave.citas, cifras.clave.asistencia, cifras.clave.cierreDeVentas, cifras.clave.citaAVenta].map((c) => <Cifra key={c.concepto} cifra={c} mostrarCobertura />)}</> : <>
        <Kpi titulo={nombreCorto("citas")} valor={num(vista.embudo.agendas)} detalle={detalles?.agendas} />
        <Kpi titulo={nombreCorto("asistencia")} valor={valorDeRazon(vista.embudo.razonShow, pct)} base={`${num(grupo.conShow)} de ${num(grupo.deals)}`} detalle={detalles?.grupo_citas} parcial={grupo.parcial} cobertura={cobertura} />
        <Kpi titulo={nombreCorto("cierre_de_ventas")} valor={valorDeRazon(vista.embudo.razonCierre, pct)} base={`${num(grupo.vendidos)} de ${num(grupo.conShow)}`} detalle={detalles?.grupo_shows} parcial={grupo.parcial} cobertura={cobertura} />
        <Kpi titulo={nombreCorto("cita_a_venta")} valor={formatearTasa(vista.embudo.agendaAVenta)} base={`${num(grupo.vendidos)} de ${num(grupo.deals)}`} detalle={detalles?.grupo_citas} />
        </>}
      </div>
    </CardContent></Card>
    {embudoComercial ? <Card><CardHeader><Titulo id="embudo" sinInfo={!!cifras}>¿Dónde se pierden?</Titulo></CardHeader><CardContent className="space-y-4">
      <div className="space-y-2">
        {enlacesDeOrigen ? <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Origen del deal"><span className="mr-1 text-xs text-muted-foreground">Origen del deal</span>{opciones.map((opcion) => <Button key={opcion.clave} size="sm" variant={origenEmbudo === opcion.clave ? "default" : "outline"} nativeButton={false} render={<Enlace precarga="nunca" scroll={false} href={enlacesDeOrigen[opcion.clave]} />}>{opcion.etiqueta}</Button>)}</div> : null}
        {enlacesDeArea ? <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Área"><span className="mr-1 text-xs text-muted-foreground">Área</span>{opcionesDeArea.map((opcion) => <Button key={opcion.clave} size="sm" variant={areaEmbudo === opcion.clave ? "default" : "outline"} nativeButton={false} render={<Enlace precarga="nunca" scroll={false} href={enlacesDeArea[opcion.clave]} />}>{opcion.etiqueta}</Button>)}</div> : null}
      </div>
      {cifras ? <p className="text-xs text-muted-foreground">Compraron solo cuenta ventas con show antes del pago; las demás van en su línea aparte. Si el periodo terminó hace poco (los días de madurez del programa), aún pueden llegar ventas. Completo significa que la persona terminó el formulario, aunque haya empezado con un parcial.</p> : null}
      <EmbudoDeBarras pasos={embudoComercial.map((paso, indice) => ({
        clave: paso.paso,
        etiqueta: ETIQUETA_DEL_PASO[paso.paso],
        cantidad: paso.cantidad,
        cifra: cifras?.embudo[indice].cantidad,
        cifraDelPct: cifras?.embudo[indice].porcentaje,
        detalle: paso.detalle,
        pctDelPaso: paso.pctDelPaso,
        perdidos: indice === 0 ? undefined : { cantidad: paso.perdidos, detalle: paso.detallePerdidos, cifra: cifras?.embudo[indice].perdidos ?? undefined },
        composicion: paso.composicion ? [
          { clave: "completo", etiqueta: "Completo", cantidad: paso.composicion.completo, tono: "primario" },
          { clave: "parcial", etiqueta: "Parcial", cantidad: paso.composicion.parcial, tono: "info" },
          { clave: "manual", etiqueta: "Manual", cantidad: paso.composicion.manual, tono: "neutro" },
        ] : undefined,
        contenidoInferior: paso.paso === "tuvieron_show" && grupo.sinMarcar > 0
          ? embudoCortado
            ? <p className="text-xs text-muted-foreground">Las citas sin marcar todavía no se cortan por origen.</p>
            : <Badge variant="alerta">{cifras?.clave.sinMarcar
              ? <Cifra cifra={cifras.clave.sinMarcar} tamano="celda" />
              : <Celda titulo="Citas pasadas sin marcar" detalle={detalles?.grupo_pendientes}>{num(grupo.sinMarcar)}</Celda>} citas pasadas sin marcar: parte pudieron ser shows</Badge>
          : paso.paso === "compraron"
            ? embudoCortado
              ? <p className="text-xs text-muted-foreground">Ventas sin llamada todavía no se corta por origen.</p>
              : ventasSinLlamada && ventasSinLlamada.deals > 0
                ? <p className="text-sm text-muted-foreground">+<Celda cifra={cifras?.auditoria.ventasSinLlamada ?? undefined} titulo="Ventas sin llamada registrada" detalle={ventasSinLlamada.detalle}>{num(ventasSinLlamada.deals)}</Celda> sin llamada registrada</p>
                : undefined
            : undefined,
      }))} />
    </CardContent></Card> : null}
    {vistaEscalera ? <Escalera vista={vistaEscalera} cifras={cifras?.escalera} /> : null}
    {dealsContraAgendas}
    <Caminos vista={vista} detalles={detallesOperacion?.embudo} cifras={cifras?.caminos} />
    {detallesOperacion ? <AgendasPorSemana semanas={detallesOperacion.semanas} proximas={detallesOperacion.proximas} cifras={cifras?.semanas} /> : null}
    {veEquipo && vistaEscalera ? <Closers vista={vista} detalles={detallesOperacion?.comparativo} escalera={vistaEscalera} dinero={dineroPorCloser} cifras={cifras?.closers} cifrasEscalera={cifras?.escalera} /> : null}
    <DetalleAuditoria vista={vista} detalles={detallesOperacion?.embudo} veEquipo={veEquipo} escalera={vistaEscalera} cifras={cifras?.auditoria} cifrasEscalera={cifras?.escalera} />
  </section>;
}
