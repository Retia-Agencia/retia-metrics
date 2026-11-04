import type { ReactNode } from "react";
import { ComoSeCalcula } from "@/components/como-se-calcula";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Comparativo } from "@/components/dashboard/operacion";
import { EmbudoDeBarras } from "@/components/graficas/barras";
import { DescargarReporte, PieDeImpresion } from "@/components/dashboard/descargar-reporte";
import { Caja, Tabla, Tarjeta, tasa } from "@/components/dashboard/piezas";
import { rangoLegible } from "@/components/dashboard/proyeccion";
import { fecha, fechaHoraEnBogota, monto, num, usd } from "@/lib/format";
import { nombreDelMes } from "@/lib/queries/metas";
import { ETIQUETA_DE_NACIMIENTO, totalDeConteos, type NacimientoDeVenta, type ReporteDiario } from "@/lib/queries/reporte-diario";
import type { DetallesDeOperacion, DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { metaDeLeads } from "@/lib/queries/proyeccion";

/**
 * Hub › Hoy como el reporte diario de Michael (373, plantilla v5 del 15-sep), con los números de sección
 * de la plantilla. Una columna por programa, lado a lado: ninguna tasa se suma entre programas (ADR 0048),
 * y el "Total" de cada tabla lleva solo conteos. La prosa interpretativa no la escribe el CRM. Los masivos
 * (sección 2) y los planes de acción (sección 6) no se dibujan: fase 2.
 */

export interface ProgramaDelReporte {
  programa: { id: string; slug: string; nombre: string };
  reporte: ReporteDiario;
  /** Las listas detrás de cada cifra; ausentes en la vista de "todos". */
  detalles?: DetallesDelDashboard;
  detallesOperacion?: DetallesDeOperacion;
}

const NACIMIENTOS: NacimientoDeVenta[] = ["agenda_del_dia", "seguimiento", "sin_llamada"];

const columnas = (n: number) =>
  n <= 1 ? "grid-cols-1" : n === 2 ? "grid-cols-1 lg:grid-cols-2 print:grid-cols-2" : "grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 print:grid-cols-3";

function Lado({ programas, children, titulo }: {
  programas: ProgramaDelReporte[];
  titulo?: string;
  children: (p: ProgramaDelReporte) => ReactNode;
}) {
  return (
    <div className={`grid gap-4 ${columnas(programas.length)}`}>
      {programas.map((p) => (
        <div key={p.programa.id} className="no-partir min-w-0 space-y-2">
          {programas.length > 1 || titulo ? (
            <h4 className="text-sm font-semibold">{p.programa.nombre}{titulo ? ` · ${titulo}` : ""}</h4>
          ) : null}
          {children(p)}
        </div>
      ))}
    </div>
  );
}

function Seccion({ numero, titulo, fuente, children }: { numero: number | string; titulo: string; fuente: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h3 className="border-b pb-1 text-lg font-semibold">{numero}. {titulo}</h3>
      {children}
      <div className="print:hidden"><ComoSeCalcula><p>{fuente}</p></ComoSeCalcula></div>
      <p className="no-partir hidden text-[11px] leading-snug text-muted-foreground print:block"><strong>Fuente:</strong> {fuente}</p>
    </section>
  );
}

const cumpl = (real: number, meta: number | null) => (meta && meta > 0 ? tasa(real / meta) : "—");
const metaTexto = (meta: number | null, decimales = 1) => (meta === null ? "—" : num(meta, decimales));

function Avance({ real, meta }: { real: number; meta: number | null }) {
  if (meta === null || meta <= 0) return null;
  const ancho = Math.min(100, Math.max(0, (real / meta) * 100));
  return <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${cumpl(real, meta)} de la meta`}><div className="h-full rounded-full bg-primary" style={{ width: `${ancho}%` }} /></div>;
}

/** El embudo del día con la pieza compartida (379). Entre Leads y Agendas no hay %: no comparten la fecha. */
function EmbudoDelDia({ reporte, detalles }: { reporte: ReporteDiario; detalles?: DetallesDelDashboard }) {
  const e = reporte.vista.embudo;
  return (
    <div className="no-partir rounded-xl bg-card p-4 shadow-tarjeta">
      <EmbudoDeBarras pasos={[
        { clave: "leads", etiqueta: "Leads", cantidad: reporte.registros },
        { clave: "agendas", etiqueta: "Agendas", cantidad: e.agendas, detalle: detalles?.agendas },
        { clave: "realizadas", etiqueta: "Realizadas", cantidad: e.llamadasConShow, detalle: detalles?.shows, pctDelPaso: reporte.showPorCita.porcentaje, etiquetaDelPct: "de show" },
        { clave: "ventas", etiqueta: "Ventas", cantidad: e.cierres, detalle: detalles?.cierres, pctDelPaso: e.pctCierre, etiquetaDelPct: "de cierre" },
      ]} />
    </div>
  );
}

function ResumenVisual({ programas }: { programas: ProgramaDelReporte[] }) {
  return <Lado programas={programas}>{({ reporte, detalles }) => {
    const dia = reporte.horizontes.find((h) => h.clave === "dia")!;
    const metaLeads = metaDeLeads(reporte.proyeccion.cohorte);
    return <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tarjeta titulo="Cupos del día" valor={<CifraConLista titulo="Ventas del día" detalle={detalles?.cierres}>{num(dia.real)}</CifraConLista>} nota={<><span>Meta: {metaTexto(dia.meta)}</span><Avance real={dia.real} meta={dia.meta} /></>} />
        <Tarjeta titulo="Leads del día" valor={num(reporte.registros)} nota={<><span>Meta: {metaTexto(metaLeads, 0)}</span><Avance real={reporte.registros} meta={metaLeads} /></>} />
        <Tarjeta titulo="Caja del día" valor={<CifraConLista titulo="Entró a caja del día" detalle={detalles?.caja}><Caja caja={reporte.caja.length ? reporte.caja : [{ moneda: "USD", total: 0 }]} /></CifraConLista>} nota="Abonos por su fecha y moneda" />
        <Tarjeta titulo="% show" valor={tasa(reporte.showPorCita.porcentaje)} nota={`${num(reporte.showPorCita.realizadas)} de ${num(reporte.showPorCita.citasQueYaDebianOcurrir)} citas`} />
      </div>
      <EmbudoDelDia reporte={reporte} detalles={detalles} />
    </div>;
  }}</Lado>;
}

function NecesariosParaLlegar({ reporte }: { reporte: ReporteDiario }) {
  const p = reporte.proyeccion;
  const c = p.supuestos.conversion;
  const origen = c.origen === "objetivo_cohorte" ? "objetivo declarado" : c.origen === "cohorte_anterior" ? "cohorte anterior" : c.origen === "cohorte_en_curso" ? "cohorte en curso" : "sin medición suficiente";
  return <div className="no-partir rounded-lg bg-muted p-3 text-sm">
    <div className="flex flex-wrap items-baseline justify-between gap-2"><strong>Necesarios para llegar</strong><span className="cifra text-lg font-semibold">{metaTexto(p.leadsRequeridosDia.valor, 0)} leads por día</span></div>
    {p.leadsRequeridosDia.valor === null ? <p className="mt-1 text-muted-foreground">{p.leadsRequeridosDia.razon}</p> : null}
    <details className="mt-2 text-xs text-muted-foreground">
      <summary className="cursor-pointer font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring print:list-none">Ver cadena de cálculo</summary>
      <div className="mt-2 space-y-1 print:block">
        <p><span className="cifra">{metaTexto(p.ventasRequeridasDia.valor)}</span> ventas por día.</p>
        {c.objetivoAgendaAVenta !== null ? <p>÷ <span className="cifra">{tasa(c.objetivoAgendaAVenta)}</span> objetivo agenda → venta ({origen}).</p> : <><p>÷ <span className="cifra">{tasa(c.pctCierre)}</span> cierre.</p><p>÷ <span className="cifra">{tasa(c.pctShow)}</span> show.</p></>}
        <p>÷ <span className="cifra">{tasa(p.supuestos.agendasPorRegistro)}</span> agenda por lead ({num(p.supuestos.agendasVentana)} agendas de {num(p.supuestos.registrosVentana)} leads; ventana de {num(p.supuestos.diasHabilesVentana)} días hábiles).</p>
        <p>Origen de la conversión: {origen}{c.cohorteCodigo ? ` · ${c.cohorteCodigo}` : ""}{c.muestra ? ` · muestra: ${num(c.muestra.personas)} personas, ${num(c.muestra.shows)} shows, ${num(c.muestra.vendidos)} ventas, ${num(c.muestra.pendientes)} pendientes` : ""}{c.madurando ? " · todavía madurando" : ""}.</p>
      </div>
    </details>
  </div>;
}

/** "martes, 3 de noviembre de 2026": el día de calendario escrito sin pasar por ninguna zona. */
export function fechaEnPalabras(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(a, m - 1, d)));
}

function Encabezado({ programas, dia }: { programas: ProgramaDelReporte[]; dia: string }) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold">
        {programas.length === 1 ? `Reporte diario · ${programas[0].programa.nombre}` : "Reporte Diario Retia"}
      </h2>
      <p className="text-sm text-muted-foreground first-letter:uppercase">{fechaEnPalabras(dia)}</p>
      <ul className="text-sm text-muted-foreground">
        {programas.map(({ programa, reporte }) => {
          const { contexto } = reporte;
          const meta = reporte.horizontes.find((h) => h.clave === "dia")?.meta ?? null;
          const partes = [
            `Semana: día ${num(contexto.semana.dia)} de ${num(contexto.semana.total)}`,
            `${nombreDelMes(contexto.mes.mes).split(" ")[0]}: día ${num(contexto.mes.dia)} de ${num(contexto.mes.total)} hábiles`,
            contexto.cohorte ? `Cohorte ${contexto.cohorte.codigo}: día ${num(contexto.cohorte.dia)} de ${num(contexto.cohorte.total)}` : "Sin cohorte con ventana de ventas",
            `Meta del día: ${meta === null ? "—" : `${num(meta, 1)} cupos`}`,
          ];
          return <li key={programa.id}>{programas.length > 1 ? <strong>{programa.nombre}: </strong> : null}{partes.join(" · ")}</li>;
        })}
      </ul>
    </div>
  );
}

/** Solo conteos (y caja por moneda): una tasa no se suma entre programas (ADR 0048). */
function TotalDelDia({ programas }: { programas: ProgramaDelReporte[] }) {
  const t = totalDeConteos(programas.map((p) => p.reporte));
  return (
    <p className="no-partir text-sm">
      <strong>Total, solo conteos:</strong>{" "}
      <span className="cifra">{num(t.registros)}</span> leads · <span className="cifra">{num(t.agendas)}</span> citas ·{" "}
      <span className="cifra">{num(t.realizadas)}</span> realizadas · <span className="cifra">{num(t.ventas)}</span> ventas ·{" "}
      caja {t.caja.length === 0 ? "—" : t.caja.map((c) => monto(c.total, c.moneda)).join(" + ")}
    </p>
  );
}

function ElDia({ programas, veEquipo }: { programas: ProgramaDelReporte[]; veEquipo: boolean }) {
  return (
    <Seccion numero={1} titulo="El día" fuente={
      "CRM de Retia, día de Bogotá. Cupos y ventas: negocios en Abonado o Completo, por el día en que entraron a venta (sin cortesías ni anulados). "
      + "Leads: registros completos del día. Vendido, Recaudado y Por cobrar: de esas mismas ventas, con los abonos a hoy. "
      + "Caja: abonos vigentes por su fecha, por moneda, sin convertir. Citas: por la fecha de la cita; las canceladas van aparte. "
      + "Cómo nació: agenda del día si hubo llamada realizada ese día, seguimiento si fue antes, sin llamada si nunca la hubo."
    }>
      <ResumenVisual programas={programas} />
      <Lado programas={programas}>{({ reporte, detalles }) => {
        const dia = reporte.horizontes.find((h) => h.clave === "dia")!;
        const metaLeads = metaDeLeads(reporte.proyeccion.cohorte);
        return (<div className="space-y-3">
          <Tabla cabeceras={["Indicador", "Meta", "Real", "Cumplimiento"]}>
            <tr>
              <td className="py-2">Cupos</td>
              <td className="py-2 text-right">{metaTexto(dia.meta)}</td>
              <td className="py-2 text-right"><CifraConLista titulo="Ventas del día" detalle={detalles?.cierres}>{num(dia.real)}</CifraConLista></td>
              <td className="py-2 text-right">{cumpl(dia.real, dia.meta)}</td>
            </tr>
            <tr>
              <td className="py-2">Leads</td>
              <td className="py-2 text-right">{metaTexto(metaLeads, 0)}</td>
              <td className="py-2 text-right">{num(reporte.registros)}</td>
              <td className="py-2 text-right">{cumpl(reporte.registros, metaLeads)}</td>
            </tr>
          </Tabla>
          <NecesariosParaLlegar reporte={reporte} />
        </div>);
      }}</Lado>

      {programas.length > 1 ? <TotalDelDia programas={programas} /> : null}

      <div className="no-partir space-y-2">
        <h4 className="text-sm font-semibold">Ventas del día</h4>
        <Lado programas={programas}>{({ reporte }) => (
          <div className="space-y-2">
            {reporte.ventas.length === 0 ? <p className="text-sm text-muted-foreground">Sin ventas ese día.</p> : veEquipo ? (
              <Tabla cabeceras={["Persona · closer", "Vendido", "Recaudado", "Por cobrar", "Cómo nació"]}>
                {reporte.ventas.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2">{v.persona ?? "Sin nombre"} <span className="text-muted-foreground">· {v.closer ?? "Sin closer"}</span></td>
                    <td className="py-2 text-right">{v.vendido === null ? "—" : usd(v.vendido)}</td>
                    <td className="py-2 text-right">{v.recaudado === null ? "—" : usd(v.recaudado)}</td>
                    <td className="py-2 text-right">{v.porCobrar === null ? "—" : usd(v.porCobrar)}</td>
                    <td className="py-2 pl-2 text-right">{ETIQUETA_DE_NACIMIENTO[v.nacio]}</td>
                  </tr>
                ))}
              </Tabla>
            ) : null}
            <p className="text-xs text-muted-foreground">
              {reporte.ventas.length} {reporte.ventas.length === 1 ? "venta" : "ventas"}
              {NACIMIENTOS.map((n) => ({ n, c: reporte.ventas.filter((v) => v.nacio === n).length })).filter((x) => x.c > 0)
                .map((x) => ` · ${x.c} ${ETIQUETA_DE_NACIMIENTO[x.n].toLowerCase()}`).join("")}
            </p>
          </div>
        )}</Lado>
      </div>

      <div className="no-partir space-y-2">
        <h4 className="text-sm font-semibold">Entró a caja del día</h4>
        <Lado programas={programas}>{({ reporte, detalles }) => (
          <div className="space-y-2 text-sm">
            <div className="cifra text-lg font-semibold">
              <CifraConLista titulo="Entró a caja del día" detalle={detalles?.caja}>
                <Caja caja={reporte.caja.length === 0 ? [{ moneda: "USD", total: 0 }] : reporte.caja} />
              </CifraConLista>
            </div>
            {reporte.caja.length === 0 ? <p className="text-muted-foreground">Ese día no se registró ningún abono.</p> : (
              <Tabla cabeceras={["Moneda", "De ventas del día", "Completan ventas anteriores"]}>
                {reporte.caja.map((fila) => (
                  <tr key={fila.moneda}>
                    <td className="py-2">{fila.moneda}</td>
                    <td className="py-2 text-right">{monto(fila.deVentasDeHoy, fila.moneda)}</td>
                    <td className="py-2 text-right">{monto(fila.deVentasAnteriores, fila.moneda)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
            {veEquipo ? (
              <details className="text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring print:list-none">Detalle de caja</summary>
              <ul className="space-y-1 text-xs text-muted-foreground print:block">
                {reporte.detalleDeCaja.map((a) => (
                  <li key={a.id}>
                    {a.persona ?? "Sin nombre"} · {monto(a.monto, a.moneda)} ·{" "}
                    {a.origen === "venta_nueva" ? "venta nueva del día"
                      : a.origen === "adicional" ? "abono adicional (1:1)"
                      : `completa su venta del ${fecha(a.ventaDelDia ?? "")}${a.closerDeLaVenta ? `, cerrada por ${a.closerDeLaVenta}` : ""}: no suma un cupo nuevo`}
                  </li>
                ))}
              </ul>
              </details>
            ) : null}
          </div>
        )}</Lado>
      </div>

      <div className="no-partir space-y-2">
        <h4 className="text-sm font-semibold">Citas y cierre del día</h4>
        <Lado programas={programas}>{({ reporte, detalles, detallesOperacion }) => {
          const e = reporte.vista.embudo;
          return (
            <div className="space-y-2">
              <Tabla cabeceras={["Agendas del día", "Realizadas", "% show", "Ventas", "% cierre"]}>
                <tr>
                  <td className="py-2"><CifraConLista titulo="Citas del día" detalle={detalles?.agendas}>{num(e.agendas)}</CifraConLista></td>
                  <td className="py-2 text-right"><CifraConLista titulo="Realizadas" detalle={detalles?.shows}>{num(e.llamadasConShow)}</CifraConLista></td>
                  <td className="py-2 text-right">{tasa(reporte.showPorCita.porcentaje)}</td>
                  <td className="py-2 text-right"><CifraConLista titulo="Ventas del día" detalle={detalles?.cierres}>{num(e.cierres)}</CifraConLista></td>
                  <td className="py-2 text-right">{tasa(e.pctCierre)}</td>
                </tr>
              </Tabla>
              <p className="text-xs text-muted-foreground">
                % de show: {num(reporte.showPorCita.realizadas)} de {num(reporte.showPorCita.citasQueYaDebianOcurrir)} citas que ya debían ocurrir.
                {e.canceladas > 0 ? ` ${num(e.canceladas)} canceladas aparte.` : ""}
              </p>
              {veEquipo ? <details><summary className="cursor-pointer text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring print:hidden">Por closer</summary><div className="mt-2 print:block print:[&_button]:hidden"><Comparativo vista={reporte.vista} detalles={detallesOperacion?.comparativo} titulo="Por closer" /></div></details> : null}
            </div>
          );
        }}</Lado>
      </div>

      {veEquipo ? (
        <details className="space-y-2">
          <summary className="cursor-pointer text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring print:list-none">Qué pasó con cada agenda</summary>
          <div className="mt-2 print:block">
          <Lado programas={programas}>{({ reporte }) => (
            reporte.resultados.length === 0 ? <p className="text-sm text-muted-foreground">Sin agendas ese día.</p> : (
              <ul className="space-y-1 text-sm">
                {reporte.resultados.map((r) => {
                  const partes = [
                    r.cierre ? `${r.cierre} ${r.cierre === 1 ? "cierre" : "cierres"}` : null,
                    r.show ? `${r.show} show sin cierre` : null,
                    r.compromisoDePago ? `${r.compromisoDePago} compromiso de pago` : null,
                    r.noShow ? `${r.noShow} no-show` : null,
                    r.reagendada ? `${r.reagendada} ${r.reagendada === 1 ? "reagendada" : "reagendadas"}` : null,
                    ...r.perdidas.map((p) => `${p.cantidad} ${p.cantidad === 1 ? "perdida" : "perdidas"} (${p.motivo})`),
                    r.pendiente ? `${r.pendiente} ${r.pendiente === 1 ? "pendiente" : "pendientes"}` : null,
                    r.canceladas ? `${r.canceladas} ${r.canceladas === 1 ? "cancelada" : "canceladas"} aparte` : null,
                  ].filter(Boolean);
                  return <li key={r.claveCloser}><strong>{r.closer ?? "Sin closer"}</strong>, {r.agendas} {r.agendas === 1 ? "agenda" : "agendas"}{partes.length ? `: ${partes.join(", ")}` : ""}</li>;
                })}
              </ul>
            )
          )}</Lado>
          </div>
        </details>
      ) : null}

      <div className="no-partir space-y-2">
        <h4 className="text-sm font-semibold">Leads del día</h4>
        <Lado programas={programas}>{({ reporte }) => (
          <p className="text-sm">
            <span className="cifra font-semibold">{num(reporte.registros)}</span> registros ·{" "}
            <span className="cifra font-semibold">{num(reporte.leadsDePauta)}</span> de pauta
          </p>
        )}</Lado>
      </div>
    </Seccion>
  );
}

function LaSemana({ programas }: { programas: ProgramaDelReporte[] }) {
  return (
    <Seccion numero={3} titulo="La semana" fuente={
      "CRM de Retia. Semana de lunes a viernes hasta el día del reporte. Meta de la semana: la compensación semanal de las metas del mes; meta a la fecha: repartida por igual entre sus días hábiles. "
      + "La meta de leads sale de la cohorte activa. La meta para llegar usa el ritmo de los últimos días hábiles de venta y cada tramo es una semana hábil."
    }>
      <Lado programas={programas}>{({ reporte }) => {
        const semana = reporte.horizontes.find((h) => h.clave === "semana")!;
        const { dia, total } = reporte.contexto.semana;
        const aLaFecha = semana.meta === null || total === 0 ? null : (semana.meta * dia) / total;
        const metaLeads = metaDeLeads(reporte.proyeccion.cohorte);
        const p = reporte.proyeccion;
        return (
          <div className="space-y-3">
            <Tabla cabeceras={["Indicador", "Meta de la semana", "Meta a la fecha", "Real", "Cumplimiento a la fecha"]}>
              <tr>
                <td className="py-2">Cupos</td>
                <td className="py-2 text-right">{metaTexto(semana.meta)}</td>
                <td className="py-2 text-right">{metaTexto(aLaFecha)}</td>
                <td className="py-2 text-right">{num(semana.real)}</td>
                <td className="py-2 text-right">{cumpl(semana.real, aLaFecha)}</td>
              </tr>
              <tr>
                <td className="py-2">Leads</td>
                <td className="py-2 text-right">{metaLeads === null ? "—" : num(metaLeads * total, 0)}</td>
                <td className="py-2 text-right">{metaLeads === null ? "—" : num(metaLeads * dia, 0)}</td>
                <td className="py-2 text-right">{reporte.leadsDeLaSemana === null ? "—" : num(reporte.leadsDeLaSemana)}</td>
                <td className="py-2 text-right">{metaLeads === null || reporte.leadsDeLaSemana === null ? "—" : cumpl(reporte.leadsDeLaSemana, metaLeads * dia)}</td>
              </tr>
            </Tabla>
            <p className="text-xs text-muted-foreground">
              Realizadas de la semana: {num(reporte.showDeLaSemana.realizadas)} de {num(reporte.showDeLaSemana.citasQueYaDebianOcurrir)} citas que ya debían ocurrir ({tasa(reporte.showDeLaSemana.porcentaje)}).
            </p>
            {p.cohorte ? (
              <div className="space-y-1 text-sm">
                <h5 className="font-medium">Reparto para llegar a {num(p.cohorte.metaCupos)} desde mañana</h5>
                <p className="text-muted-foreground">
                  Faltan {num(p.faltan)} cupos en {num(p.diasHabilesRestantes)} días hábiles
                  {p.ventasRequeridasDia.valor === null ? "" : `: ${num(p.ventasRequeridasDia.valor, 1)} ventas por día`}.
                </p>
                <details><summary className="cursor-pointer font-medium text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring print:list-none">Reparto semanal</summary><ul className="mt-1 text-muted-foreground print:block">
                  {p.repartoSemanal.map((t) => (
                    <li key={t.desde}>{t.tipo === "resto_semana" ? "Resto de esta semana" : t.tipo === "final" ? "Días sueltos del final" : "Semana"} ({rangoLegible(t.desde, t.hasta)}): {num(t.ventas, 1)} cupos</li>
                  ))}
                </ul></details>
              </div>
            ) : <p className="text-sm text-muted-foreground">Sin cohorte con ventana de ventas.</p>}
          </div>
        );
      }}</Lado>
    </Seccion>
  );
}

export function ReporteDiarioVista({ programas, dia, hoy, veEquipo, selector, vamosALlegar, configuracion }: {
  programas: ProgramaDelReporte[];
  dia: string;
  hoy: string;
  veEquipo: boolean;
  /** El selector de día, ya armado por la página. */
  selector: ReactNode;
  /** El bloque "¿Vamos a llegar?" (371): ocupa el lugar de las secciones 4 y 5. */
  vamosALlegar: ReactNode;
  configuracion?: ReactNode;
}) {
  void hoy;
  return (
    <section id="hoy" className="scroll-mt-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        {selector}
        <div className="flex items-center gap-2">{configuracion}<DescargarReporte /></div>
      </div>
      <div id="reporte-diario" className="space-y-6">
        <PieDeImpresion generado={fechaHoraEnBogota(new Date())} />
        <Encabezado programas={programas} dia={dia} />
        <ElDia programas={programas} veEquipo={veEquipo} />
        <LaSemana programas={programas} />
        <Seccion numero="4 y 5" titulo="El corte y el mes" fuente={
      "CRM de Retia. Lo vendido de la cohorte activa y del mes contra su meta, en cupos y en USD; no depende de ningún filtro y la meta no se reparte entre closers."
    }><div className="no-partir">{vamosALlegar}</div></Seccion>
      </div>
    </section>
  );
}
