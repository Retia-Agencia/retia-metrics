import type { ReactNode } from "react";
import type { ProgramaVisible } from "@/lib/auth/alcance";
import { monto, num, pct } from "@/lib/format";
import { valorDeRazon } from "@/lib/cobertura";
import { metaDeLeads } from "@/lib/queries/proyeccion";
import type { ReporteDiario } from "@/lib/queries/reporte-diario";
import { nombreCorto } from "@/lib/vocabulario-metricas";

export interface ProgramaDelReporteCompleto {
  programa: ProgramaVisible;
  reporte: ReporteDiario;
}

function fechaEnPalabras(dia: string): string {
  const [a, m, d] = dia.split("-").map(Number);
  return new Intl.DateTimeFormat("es-CO", {
    weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

function Celda({ children }: { children: ReactNode }) {
  return <td className="cifra px-2 py-1.5 text-right align-top font-medium">{children}</td>;
}

function Tabla({ children }: { children: ReactNode }) {
  return <table className="w-full border-collapse text-sm"><tbody className="divide-y divide-border">{children}</tbody></table>;
}

function Fila({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return <tr><th scope="row" className="px-2 py-1.5 text-left align-top font-normal text-muted-foreground">{rotulo}</th><Celda>{children}</Celda></tr>;
}

function TarjetaDePrograma({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <article className="no-partir overflow-hidden rounded-xl bg-card shadow-tarjeta">
      <h3 className="border-b border-border px-3 py-2 text-base font-semibold">{titulo}</h3>
      {children}
    </article>
  );
}

function cajaLegible(reporte: ReporteDiario): string {
  return reporte.caja.map((c) => monto(c.total, c.moneda)).join(" + ");
}

function Seccion({ numero, titulo, children }: { numero: string; titulo: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="bloque-titulo border-b border-border pb-1">
        <h2 className="text-lg font-semibold">{numero}. {titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function ElDia({ reportes, veEquipo }: { reportes: ProgramaDelReporteCompleto[]; veEquipo: boolean }) {
  return (
    <Seccion numero="1" titulo="El día">
      <div className="grid gap-4 lg:grid-cols-3 print:grid-cols-3">
        {reportes.map(({ programa, reporte }) => {
          const dia = reporte.horizontes.find((h) => h.clave === "dia")!;
          const objetivoLeads = metaDeLeads(reporte.proyeccion.cohorte);
          const embudo = reporte.vista.embudo;
          const closersConActividad = reporte.vista.comparativo.filter(
            (closer) => closer.agendas > 0 || closer.llamadasConShow > 0 || closer.cierres > 0,
          );
          return (
            <TarjetaDePrograma key={programa.id} titulo={programa.nombre}>
              <Tabla>
                <Fila rotulo={nombreCorto("objetivo_del_dia")}>{dia.meta === null ? "—" : num(dia.meta, 1)}</Fila>
                <Fila rotulo={nombreCorto("cupos_vendidos")}>{num(dia.real)}</Fila>
                <Fila rotulo={nombreCorto("objetivo_de_leads")}>{objetivoLeads === null ? "—" : num(objetivoLeads)}</Fila>
                <Fila rotulo={`${nombreCorto("leads")} de hoy`}>{num(reporte.registros)}</Fila>
                <Fila rotulo={`${nombreCorto("entro_a_caja")} hoy`}>{cajaLegible(reporte)}</Fila>
                <Fila rotulo={nombreCorto("citas_del_dia")}>{num(embudo.agendas)}</Fila>
                <Fila rotulo={nombreCorto("shows")}>{num(embudo.llamadasConShow)}</Fila>
                <Fila rotulo={nombreCorto("asistencia")}>{valorDeRazon(embudo.razonShow, pct)}</Fila>
                <Fila rotulo={nombreCorto("ventas")}>{num(embudo.cierres)}</Fila>
                <Fila rotulo={nombreCorto("cierre_de_ventas")}>{valorDeRazon(embudo.razonCierre, pct)}</Fila>
              </Tabla>
              {veEquipo && closersConActividad.length > 0 ? (
                <div className="border-t border-border px-2 py-2">
                  <h4 className="mb-1 text-xs font-semibold text-muted-foreground">Por closer</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead><tr className="text-left text-muted-foreground">
                        <th className="px-1 py-1 font-medium">Closer</th><th className="px-1 py-1 text-right font-medium">{nombreCorto("citas")}</th>
                        <th className="px-1 py-1 text-right font-medium">{nombreCorto("shows")}</th><th className="px-1 py-1 text-right font-medium">{nombreCorto("asistencia")}</th>
                        <th className="px-1 py-1 text-right font-medium">{nombreCorto("ventas")}</th><th className="px-1 py-1 text-right font-medium">{nombreCorto("cierre_de_ventas")}</th>
                      </tr></thead>
                      <tbody className="divide-y divide-border">{closersConActividad.map((closer) => (
                        <tr key={closer.clave}>
                          <th scope="row" className="px-1 py-1 text-left font-normal">{closer.closerId ?? "Sin responsable"}</th>
                          <Celda>{num(closer.agendas)}</Celda><Celda>{num(closer.llamadasConShow)}</Celda>
                          <Celda>{valorDeRazon(closer.razonShow, pct)}</Celda><Celda>{num(closer.cierres)}</Celda>
                          <Celda>{valorDeRazon(closer.razonCierre, pct)}</Celda>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </div>
              ) : null}
            </TarjetaDePrograma>
          );
        })}
      </div>
    </Seccion>
  );
}

function LaSemana({ reportes }: { reportes: ProgramaDelReporteCompleto[] }) {
  return (
    <Seccion numero="3" titulo="La semana">
      <div className="grid gap-4 lg:grid-cols-3 print:grid-cols-3">
        {reportes.map(({ programa, reporte }) => {
          const semana = reporte.horizontes.find((h) => h.clave === "semana")!;
          return (
            <TarjetaDePrograma key={programa.id} titulo={programa.nombre}>
              <Tabla>
                <Fila rotulo={nombreCorto("objetivo_semana")}>{semana.meta === null ? "—" : num(semana.meta, 1)}</Fila>
                <Fila rotulo={nombreCorto("llevamos")}>{num(semana.real)}</Fila>
                <Fila rotulo={nombreCorto("por_dia_habil")}>
                  {reporte.proyeccion.ventasRequeridasDia.valor === null ? "—" : num(reporte.proyeccion.ventasRequeridasDia.valor, 1)}
                </Fila>
              </Tabla>
            </TarjetaDePrograma>
          );
        })}
      </div>
    </Seccion>
  );
}

function ElCorte({ reportes }: { reportes: ProgramaDelReporteCompleto[] }) {
  return (
    <Seccion numero="4" titulo="El corte">
      <div className="grid gap-4 lg:grid-cols-3 print:grid-cols-3">
        {reportes.map(({ programa, reporte }) => {
          const cohorte = reporte.horizontes.find((h) => h.clave === "cohorte")!;
          return (
            <TarjetaDePrograma key={programa.id} titulo={programa.nombre}>
              <Tabla>
                <Fila rotulo="Cohorte">{reporte.contexto.cohorte?.codigo ?? "—"}</Fila>
                <Fila rotulo={nombreCorto("cupos_vendidos")}>{num(cohorte.real)}</Fila>
                <Fila rotulo={nombreCorto("objetivo_cohorte")}>{cohorte.meta === null ? "—" : num(cohorte.meta)}</Fila>
                <Fila rotulo="Cumplimiento al corte">{cohorte.cumplimiento === null ? "—" : pct(cohorte.cumplimiento)}</Fila>
              </Tabla>
            </TarjetaDePrograma>
          );
        })}
      </div>
    </Seccion>
  );
}

export function ReporteDeTodosLosProgramas({ reportes, dia, generado, veEquipo }: {
  reportes: ProgramaDelReporteCompleto[];
  dia: string;
  generado: string;
  veEquipo: boolean;
}) {
  return (
    <main id="reporte-diario" className="space-y-8 rounded-xl bg-card p-5 shadow-tarjeta print:rounded-none print:p-0 print:shadow-none">
      <header className="encabezado-reporte space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Retia · Reporte diario</p>
        <h1 className="text-2xl font-semibold">Todos los programas</h1>
        <p className="text-sm text-muted-foreground first-letter:uppercase">{fechaEnPalabras(dia)}</p>
      </header>
      <ElDia reportes={reportes} veEquipo={veEquipo} />
      <LaSemana reportes={reportes} />
      <ElCorte reportes={reportes} />
      <footer className="border-t border-border pt-2 text-xs text-muted-foreground">
        Datos del CRM al {generado} (Bogotá)
      </footer>
    </main>
  );
}
