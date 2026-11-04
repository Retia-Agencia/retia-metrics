import type { ReactNode } from "react";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Comparativo } from "@/components/dashboard/operacion";
import { DescargarReporte, PieDeImpresion } from "@/components/dashboard/descargar-reporte";
import { Caja, Tabla, tasa } from "@/components/dashboard/piezas";
import { rangoLegible } from "@/components/dashboard/proyeccion";
import { Button } from "@/components/ui/button";
import { fecha, fechaHoraEnBogota, monto, num, usd } from "@/lib/format";
import { nombreDelMes } from "@/lib/queries/metas";
import { ETIQUETA_DE_NACIMIENTO, totalDeConteos, type NacimientoDeVenta, type ReporteDiario } from "@/lib/queries/reporte-diario";
import type { DetallesDeOperacion, DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import { sumarDias } from "@/lib/rangos";

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
      <p className="no-partir text-[11px] leading-snug text-muted-foreground"><strong>Fuente:</strong> {fuente}</p>
    </section>
  );
}

const cumpl = (real: number, meta: number | null) => (meta && meta > 0 ? tasa(real / meta) : "—");
const metaTexto = (meta: number | null, decimales = 1) => (meta === null ? "—" : num(meta, decimales));

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
      <Lado programas={programas}>{({ reporte, detalles }) => {
        const dia = reporte.horizontes.find((h) => h.clave === "dia")!;
        const metaLeads = reporte.proyeccion.leadsRequeridosDia;
        return (
          <Tabla cabeceras={["Indicador", "Meta", "Real", "Cumplimiento"]}>
            <tr>
              <td className="py-2">Cupos</td>
              <td className="py-2 text-right">{metaTexto(dia.meta)}</td>
              <td className="py-2 text-right"><CifraConLista titulo="Ventas del día" detalle={detalles?.cierres}>{num(dia.real)}</CifraConLista></td>
              <td className="py-2 text-right">{cumpl(dia.real, dia.meta)}</td>
            </tr>
            <tr>
              <td className="py-2">Leads</td>
              <td className="py-2 text-right">{metaTexto(metaLeads.valor)}</td>
              <td className="py-2 text-right">{num(reporte.registros)}</td>
              <td className="py-2 text-right">{cumpl(reporte.registros, metaLeads.valor)}</td>
            </tr>
          </Tabla>
        );
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
              <ul className="space-y-1 text-xs text-muted-foreground">
                {reporte.detalleDeCaja.map((a) => (
                  <li key={a.id}>
                    {a.persona ?? "Sin nombre"} · {monto(a.monto, a.moneda)} ·{" "}
                    {a.origen === "venta_nueva" ? "venta nueva del día"
                      : a.origen === "adicional" ? "abono adicional (1:1)"
                      : `completa su venta del ${fecha(a.ventaDelDia ?? "")}${a.closerDeLaVenta ? `, cerrada por ${a.closerDeLaVenta}` : ""}: no suma un cupo nuevo`}
                  </li>
                ))}
              </ul>
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
              {veEquipo ? <Comparativo vista={reporte.vista} detalles={detallesOperacion?.comparativo} titulo="Por closer" /> : null}
            </div>
          );
        }}</Lado>
      </div>

      {veEquipo ? (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold">Qué pasó con cada agenda</h4>
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
        const metaLeads = reporte.proyeccion.cohorte?.metaLeadsDia ?? null;
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
                <h5 className="font-medium">Meta para llegar a {num(p.cohorte.metaCupos)} desde mañana</h5>
                <p className="text-muted-foreground">
                  Faltan {num(p.faltan)} cupos en {num(p.diasHabilesRestantes)} días hábiles
                  {p.ventasRequeridasDia.valor === null ? "" : `: ${num(p.ventasRequeridasDia.valor, 1)} por día`}
                  {p.leadsRequeridosDia.valor === null ? "" : ` y ${num(p.leadsRequeridosDia.valor, 0)} leads por día hábil`}.
                </p>
                <ul className="text-muted-foreground">
                  {p.repartoSemanal.map((t) => (
                    <li key={t.desde}>{t.tipo === "resto_semana" ? "Resto de esta semana" : t.tipo === "final" ? "Días sueltos del final" : "Semana"} ({rangoLegible(t.desde, t.hasta)}): {num(t.ventas, 1)} cupos</li>
                  ))}
                </ul>
              </div>
            ) : <p className="text-sm text-muted-foreground">Sin cohorte con ventana de ventas.</p>}
          </div>
        );
      }}</Lado>
    </Seccion>
  );
}

export function ReporteDiarioVista({ programas, dia, hoy, veEquipo, selector, vamosALlegar }: {
  programas: ProgramaDelReporte[];
  dia: string;
  hoy: string;
  veEquipo: boolean;
  /** El selector de día, ya armado por la página. */
  selector: ReactNode;
  /** El bloque "¿Vamos a llegar?" (371): ocupa el lugar de las secciones 4 y 5. */
  vamosALlegar: ReactNode;
}) {
  void hoy;
  return (
    <section id="hoy" className="scroll-mt-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        {selector}
        <DescargarReporte />
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

/** Hoy · Ayer · una fecha: el único control de la pestaña. Un formulario GET: funciona sin JavaScript. */
export function SelectorDeDia({ dia, hoy, base }: { dia: string; hoy: string; base: { path: string; params: Record<string, string> } }) {
  const href = (fechaElegida: string | null) => {
    const q = new URLSearchParams(base.params);
    q.set("seccion", "hoy");
    if (fechaElegida) q.set("fecha", fechaElegida);
    return `${base.path}?${q.toString()}`;
  };
  const ayer = sumarDias(hoy, -1);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant={dia === hoy ? "default" : "outline"} nativeButton={false} render={<a href={href(null)} />}>Hoy</Button>
      <Button size="sm" variant={dia === ayer ? "default" : "outline"} nativeButton={false} render={<a href={href(ayer)} />}>Ayer</Button>
      <form method="get" action={base.path} className="flex items-center gap-2">
        {Object.entries(base.params).filter(([k]) => k !== "fecha" && k !== "seccion").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
        <input type="hidden" name="seccion" value="hoy" />
        <label className="sr-only" htmlFor="fecha-del-reporte">Fecha del reporte</label>
        <input id="fecha-del-reporte" type="date" name="fecha" defaultValue={dia} max={hoy} className="h-8 rounded-md border bg-background px-2 text-sm" />
        <Button size="sm" type="submit" variant="outline">Ver</Button>
      </form>
    </div>
  );
}
