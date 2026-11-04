import type { ReactNode } from "react";
import Link from "next/link";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Alertas } from "@/components/dashboard/alertas";
import { ReporteDiarioVista, type ProgramaDelReporte } from "@/components/dashboard/reporte-diario";
import { Tarjeta, tasa } from "@/components/dashboard/piezas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { horaEnBogota, num } from "@/lib/format";
import type { Alerta } from "@/lib/queries/alertas";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { DetalleDeCifra, DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import type { FilaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { ETIQUETA_DE_RESULTADO, TONO_DE_RESULTADO } from "@/lib/deals/estado-de-llamada";

/**
 * Hub › Hoy (ticket 252, 373, ADR 0086): el reporte diario de Michael (`ReporteDiarioVista`) y, debajo,
 * "Para seguir el día" (agenda por hora, mañana, lo que pide atención y las metas), que no va al PDF.
 * Este componente no calcula ninguna cifra.
 */

function Agenda({ titulo, filas, corte, veEquipo, slug }: { titulo: string; filas: FilaDeMetrica[]; corte: Date; veEquipo: boolean; slug: string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{titulo}</CardTitle></CardHeader>
      <CardContent>
        {filas.length === 0 ? <p className="text-sm text-muted-foreground">Sin citas.</p> : (
          <ul className="divide-y text-sm">
            {filas.map((fila) => {
              const cancelada = fila.resultado === "cancelada";
              const vencida = fila.resultado === "agendada" && fila.citaEn != null && fila.citaEn <= corte;
              const resultado = fila.resultado as keyof typeof ETIQUETA_DE_RESULTADO;
              const contenido = <>
                  <span className="cifra w-14 font-medium">{fila.citaEn ? horaEnBogota(fila.citaEn) : "—"}</span>
                  {veEquipo ? <span className="min-w-0 flex-1 truncate">{fila.persona?.nombre ?? "Sin nombre"} <span className="text-muted-foreground">· {fila.closer ?? "Sin closer"}</span></span> : <span className="flex-1" />}
                  <Badge variant={vencida ? "peligro" : (TONO_DE_RESULTADO[resultado] ?? "neutro")}>
                    {vencida ? "Sin resultado" : (ETIQUETA_DE_RESULTADO[resultado] ?? "Otro")}
                  </Badge>
                </>;
              const clase = `flex flex-wrap items-center gap-2 py-2 outline-none transition-colors duration-150 ${cancelada ? "text-muted-foreground" : ""}`;
              return <li key={fila.id}>{fila.dealId ? <Link className={`${clase} hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring`} href={`/p/${encodeURIComponent(slug)}/deals/${fila.dealId}`}>{contenido}</Link> : <div className={clase}>{contenido}</div>}</li>;
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** 5. Las banderas rojas (lo que era el Pulso) y las alertas por persistencia. */
function Banderas({ vista, detalles }: { vista: VistaDelDashboard; detalles?: DetallesDelDashboard }) {
  const banderas = [
    ["Shows sin Grain", vista.sinGrain.sinGrain, detalles?.shows_sin_grain, `${tasa(vista.sinGrain.pct)} de ${num(vista.sinGrain.shows)} shows de hoy`],
    ["Llamadas pasadas sin resultado", vista.sinResultado, detalles?.sin_resultado],
    ["Atendidos sin valor vendido", vista.banderas.sinValor.cantidad, detalles?.atendidos_sin_valor, `${tasa(vista.banderas.sinValor.pct)} de ${num(vista.banderas.atendidos)} atendidos · a hoy`],
    ["Atendidos sin Grain", vista.banderas.sinGrain.cantidad, detalles?.atendidos_sin_grain, `${tasa(vista.banderas.sinGrain.pct)} de ${num(vista.banderas.atendidos)} atendidos · a hoy`],
  ] as const;
  const bandera = (titulo: string, cantidad: number, detalle: DetallesDelDashboard[keyof DetallesDelDashboard] | undefined, nota?: string) => (
    <Tarjeta titulo={titulo} nota={nota} valor={
      <span className={cantidad > 0 ? "text-tono-peligro" : undefined}>
        <CifraConLista titulo={titulo} detalle={detalle}>{num(cantidad)}</CifraConLista>
      </span>
    } />
  );
  return (
    <div className="space-y-2">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {banderas.filter(([, cantidad]) => cantidad > 0).map(([titulo, cantidad, detalle, nota]) =>
          <div key={titulo}>{bandera(titulo, cantidad, detalle, nota)}</div>)}
      </div>
      {banderas.some(([, cantidad]) => cantidad === 0) ? (
        <p className="text-sm text-muted-foreground">Sin pendientes: {banderas.filter(([, cantidad]) => cantidad === 0).map(([titulo]) => titulo.toLocaleLowerCase("es")).join(", ")}.</p>
      ) : null}
    </div>
  );
}

export function Hoy({
  programas,
  dia,
  hoy,
  selector,
  vamosALlegar,
  vista,
  detalles,
  alertas,
  slug,
  veEquipo,
  metas,
  agendaDeHoy,
  citasDeManana,
  corte,
  detalleManana,
  configuracion,
}: {
  programas: ProgramaDelReporte[];
  dia: string;
  hoy: string;
  selector: ReactNode;
  vamosALlegar: ReactNode;
  /** La vista de HOY, para las banderas de "Para seguir el día". */
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  alertas: Alerta[];
  slug: string;
  /** Sin equipo comercial (paid trafficker): sin las tablas por closer ni los nombres. */
  veEquipo: boolean;
  /** Las metas del mes con sus flechas (lo que era la página Metas); las arma la página. */
  metas: ReactNode;
  agendaDeHoy: FilaDeMetrica[];
  citasDeManana: FilaDeMetrica[];
  corte: Date;
  detalleManana?: DetalleDeCifra;
  configuracion?: ReactNode;
}) {
  // Lo que sirve para seguir el día vive de hoy hacia adelante: en un día pasado no se dibuja (373).
  const esHoy = dia === hoy;
  return (
    <div className="space-y-6">
      <ReporteDiarioVista programas={programas} dia={dia} hoy={hoy} veEquipo={veEquipo} selector={selector} vamosALlegar={vamosALlegar} configuracion={configuracion} />
      {esHoy ? (
        <section className="space-y-6 border-t pt-6 print:hidden">
          <h2 className="text-xl font-semibold">Para seguir el día</h2>
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">La agenda de hoy</h3>
            <Agenda titulo="Por hora" filas={agendaDeHoy} corte={corte} veEquipo={veEquipo} slug={slug} />
          </section>
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Mañana</h3>
            <Tarjeta titulo="Citas vivas" valor={<CifraConLista titulo="Citas de mañana" detalle={detalleManana}>{num(citasDeManana.length)}</CifraConLista>} nota="Por la fecha de la cita" />
          </section>
          <section className="space-y-3">
            <h3 className="text-lg font-semibold">Lo que pide atención</h3>
            <Banderas vista={vista} detalles={detalles} />
            <Alertas alertas={alertas} slug={slug} configurable={veEquipo} />
          </section>
          {metas}
        </section>
      ) : null}
    </div>
  );
}
