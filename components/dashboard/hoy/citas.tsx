import Link from "next/link";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Comparativo } from "@/components/dashboard/operacion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lado } from "@/components/dashboard/hoy/comunes";
import type { ProgramaDelReporte } from "@/components/dashboard/hoy/tipos";
import { ETIQUETA_DE_RESULTADO, TONO_DE_RESULTADO } from "@/lib/deals/estado-de-llamada";
import { horaEnBogota, num } from "@/lib/format";
import type { FilaDeMetrica } from "@/lib/queries/metricas-con-filas";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";
import { nombreCorto } from "@/lib/vocabulario-metricas";

function Conteo({ titulo, cantidad, detalle, alerta }: { titulo: string; cantidad: number; detalle?: DetalleDeCifra; alerta?: boolean }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className={`cifra text-xl font-semibold ${alerta && cantidad > 0 ? "text-tono-peligro" : ""}`}>
        <CifraConLista titulo={titulo} detalle={detalle}>{num(cantidad)}</CifraConLista>
      </div>
    </div>
  );
}

function FilaDeCita({ fila, corte, veEquipo, slug, conCloser }: { fila: FilaDeMetrica; corte: Date; veEquipo: boolean; slug: string; conCloser: boolean }) {
  const cancelada = fila.resultado === "cancelada";
  const vencida = fila.resultado === "agendada" && fila.citaEn != null && fila.citaEn <= corte;
  const resultado = fila.resultado as keyof typeof ETIQUETA_DE_RESULTADO;
  const contenido = <>
    <span className="cifra w-14 shrink-0 font-medium">{fila.citaEn ? horaEnBogota(fila.citaEn) : "—"}</span>
    {veEquipo
      ? <span className="min-w-0 flex-1 truncate">{fila.persona?.nombre ?? "Sin nombre"}{conCloser ? <span className="text-muted-foreground"> · {fila.closer ?? "Sin closer"}</span> : null}</span>
      : <span className="flex-1" />}
    <Badge variant={vencida ? "peligro" : (TONO_DE_RESULTADO[resultado] ?? "neutro")}>
      {vencida ? nombreCorto("citas_pendientes") : (ETIQUETA_DE_RESULTADO[resultado] ?? "Otro")}
    </Badge>
  </>;
  const clase = `flex flex-wrap items-center gap-2 py-2 outline-none transition-colors duration-150 ${cancelada ? "text-muted-foreground" : ""}`;
  return (
    <li>
      {fila.dealId
        ? <Link className={`${clase} hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring`} href={`/p/${encodeURIComponent(slug)}/deals/${fila.dealId}`}>{contenido}</Link>
        : <div className={clase}>{contenido}</div>}
    </li>
  );
}

/** Las citas del día agrupadas por closer (quien ve al equipo) o seguidas por hora (quien no). */
function ListaDeCitas({ filas, corte, veEquipo, slug }: { filas: FilaDeMetrica[]; corte: Date; veEquipo: boolean; slug: string }) {
  if (filas.length === 0) return <p className="text-sm text-muted-foreground">No hay citas ese día.</p>;
  if (!veEquipo) {
    return <ul className="divide-y text-sm">{filas.map((f) => <FilaDeCita key={f.id} fila={f} corte={corte} veEquipo={false} slug={slug} conCloser={false} />)}</ul>;
  }
  const grupos = new Map<string, { closer: string | null; filas: FilaDeMetrica[] }>();
  for (const f of filas) {
    const g = grupos.get(f.claveCloser) ?? { closer: f.closer, filas: [] };
    g.filas.push(f);
    grupos.set(f.claveCloser, g);
  }
  const ordenados = [...grupos.values()].sort((a, b) => (a.closer ?? "~").localeCompare(b.closer ?? "~", "es"));
  return (
    <div className="space-y-4">
      {ordenados.map((g) => {
        const vivas = g.filas.filter((f) => f.resultado !== "cancelada").length;
        const canceladas = g.filas.length - vivas;
        return (
          <section key={g.closer ?? "sin-closer"} className="space-y-1">
            <h5 className="text-sm font-medium">
              {g.closer ?? "Sin closer"}
              <span className="font-normal text-muted-foreground"> · {num(vivas)} {vivas === 1 ? "cita" : "citas"}{canceladas > 0 ? ` · ${num(canceladas)} ${canceladas === 1 ? "cancelada" : "canceladas"}` : ""}</span>
            </h5>
            <ul className="divide-y text-sm">{g.filas.map((f) => <FilaDeCita key={f.id} fila={f} corte={corte} veEquipo slug={slug} conCloser={false} />)}</ul>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Citas del día (378): cuántas hay y cómo van (cada conteo abre su lista) y, debajo, cada cita con lo que
 * pasó con ella, agrupada por closer. Cada fila abre el negocio. Aquí vive lo que antes se repetía en
 * "Qué pasó con cada agenda", "Por closer" y "Citas y cierre del día".
 */
export function CitasDelDia({ programas, veEquipo }: { programas: ProgramaDelReporte[]; veEquipo: boolean }) {
  return (
    <Lado programas={programas}>{({ programa, reporte, detalles, detallesOperacion }) => {
      const e = reporte.vista.embudo;
      return (
        <div className="space-y-4">
          <Card className="partible">
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Conteo titulo={nombreCorto("citas_del_dia")} cantidad={e.agendas} detalle={detalles?.agendas} />
                <Conteo titulo={nombreCorto("shows")} cantidad={e.llamadasConShow} detalle={detalles?.shows} />
                <Conteo titulo={nombreCorto("citas_canceladas")} cantidad={e.canceladas} detalle={detalles?.canceladas} />
                <Conteo titulo={nombreCorto("citas_pendientes")} cantidad={reporte.vista.sinResultado} detalle={detalles?.sin_resultado} alerta />
              </div>
              <div className="space-y-2 border-t pt-3">
                <h4 className="text-sm font-medium">¿Qué pasó con cada cita?</h4>
                <ListaDeCitas filas={reporte.agendaDeHoy} corte={reporte.corte} veEquipo={veEquipo} slug={programa.slug} />
              </div>
            </CardContent>
          </Card>
          {veEquipo ? (
            <div className="no-partir"><Comparativo vista={reporte.vista} detalles={detallesOperacion?.comparativo} titulo="¿Cómo va cada closer?" /></div>
          ) : null}
        </div>
      );
    }}</Lado>
  );
}
