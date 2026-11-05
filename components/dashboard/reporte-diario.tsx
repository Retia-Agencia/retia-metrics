import type { ReactNode } from "react";
import { DescargarReporte, PieDeImpresion } from "@/components/dashboard/descargar-reporte";
import { Bloque } from "@/components/dashboard/hoy/comunes";
import { CifrasClave } from "@/components/dashboard/hoy/cifras-clave";
import { CitasDelDia } from "@/components/dashboard/hoy/citas";
import { DineroDelDia } from "@/components/dashboard/hoy/dinero";
import { EmbudoDelDia } from "@/components/dashboard/hoy/embudo";
import { seccionesDeInfoDeHoy } from "@/components/dashboard/hoy/info-de-hoy";
import { SemanaEnCurso } from "@/components/dashboard/hoy/semana";
import type { ProgramaDelReporte } from "@/components/dashboard/hoy/tipos";
import { InfoDePagina } from "@/components/hub/info-de-pagina";
import { TablaDeContenido } from "@/components/hub/tabla-de-contenido";
import { fechaHoraEnBogota, monto, num } from "@/lib/format";
import { nombreDelMes } from "@/lib/queries/metas";
import { totalDeConteos } from "@/lib/queries/reporte-diario";
import { nombreCorto } from "@/lib/vocabulario-metricas";

export type { ProgramaDelReporte } from "@/components/dashboard/hoy/tipos";

/**
 * Hub › Hoy como el reporte diario de Michael (373), rehecho en tarjetas (378): cada bloque responde una
 * pregunta, lleva su "?" al Info y cada cifra abre su lista. Una columna por programa, lado a lado: ninguna
 * tasa se suma entre programas (ADR 0048). La prosa interpretativa no la escribe el CRM. Los masivos y los
 * planes de acción no se dibujan: fase 2.
 */

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
          const objetivo = reporte.horizontes.find((h) => h.clave === "dia")?.meta ?? null;
          const partes = [
            `Semana: día ${num(contexto.semana.dia)} de ${num(contexto.semana.total)}`,
            `${nombreDelMes(contexto.mes.mes).split(" ")[0]}: día ${num(contexto.mes.dia)} de ${num(contexto.mes.total)} hábiles`,
            contexto.cohorte ? `Cohorte ${contexto.cohorte.codigo}: día ${num(contexto.cohorte.dia)} de ${num(contexto.cohorte.total)}` : "Sin cohorte con ventana de ventas",
            `${nombreCorto("objetivo_del_dia")}: ${objetivo === null ? "—" : `${num(objetivo, 1)} cupos`}`,
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
      <span className="cifra">{num(t.realizadas)}</span> realizadas · <span className="cifra">{num(t.ventas)}</span> cupos vendidos ·{" "}
      caja {t.caja.length === 0 ? "—" : t.caja.map((c) => monto(c.total, c.moneda)).join(" + ")}
    </p>
  );
}

const FUENTES = {
  cifras: "CRM de Retia, día de Bogotá. Cupos: negocios en Abonado o Completo por el día en que entraron a venta (sin cortesías ni anulados). Leads: registros completos del día. Caja: abonos vigentes por su fecha, por moneda, sin convertir.",
  embudo: "Citas por la fecha de la cita; las canceladas van aparte. Asistencia: realizadas entre las citas que ya debían ocurrir. Cierre: asistentes que compraron entre los que asistieron.",
  dinero: "Vendido, recaudado y por cobrar: de las ventas de hoy, con los abonos a hoy. Cómo nació: agenda del día si hubo llamada realizada ese día, seguimiento si fue antes, sin llamada si nunca la hubo.",
  citas: "Citas con fecha de hoy y lo que pasó con cada una, por closer.",
  pendientes: "Pendientes de ahora; no van en el PDF.",
  semana: "CRM de Retia. Semana de lunes a viernes hasta el día del reporte. Objetivo de la semana: la compensación semanal de los objetivos del mes; esperado a hoy: repartido por igual entre sus días hábiles. El objetivo de leads sale de la cohorte activa; el reparto usa el ritmo de los últimos días hábiles de venta.",
  objetivos: "CRM de Retia. Lo vendido de la cohorte activa y del mes contra su objetivo, en cupos y en USD; no depende de ningún filtro y el objetivo no se reparte entre closers.",
} as const;

export function ReporteDiarioVista({ programas, dia, hoy, veEquipo, selector, vamosALlegar, configuracion, definirObjetivo, pendientes }: {
  programas: ProgramaDelReporte[];
  dia: string;
  hoy: string;
  veEquipo: boolean;
  /** El selector de día, ya armado por la página. */
  selector: ReactNode;
  /** El bloque "¿Vamos a llegar?" (371): el mes y la cohorte contra su objetivo. */
  vamosALlegar: ReactNode;
  configuracion?: ReactNode;
  /** El mismo panel de configuración como enlace corto, para las tarjetas que no tienen objetivo. */
  definirObjetivo?: ReactNode;
  /** Alertas y pendientes: solo existen para hoy y no van al PDF. */
  pendientes?: ReactNode;
}) {
  void hoy;
  const contenido = [
    { id: "cifras", titulo: "Cifras del día" },
    { id: "embudo", titulo: "Del lead a la venta" },
    { id: "dinero", titulo: "Dinero" },
    { id: "citas", titulo: "Citas" },
    ...(pendientes ? [{ id: "pendientes", titulo: "Alertas y pendientes" }] : []),
    { id: "semana", titulo: "La semana" },
    { id: "objetivos", titulo: "Objetivos" },
  ];
  return (
    <section id="hoy" className="scroll-mt-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        {selector}
        <div className="flex items-center gap-2">
          {configuracion}
          <DescargarReporte />
          <InfoDePagina titulo="Hoy: qué hay y cómo se calcula" secciones={seccionesDeInfoDeHoy(programas)} />
        </div>
      </div>
      <TablaDeContenido secciones={contenido} />
      <div id="reporte-diario" className="space-y-8">
        <PieDeImpresion generado={fechaHoraEnBogota(new Date())} />
        <Encabezado programas={programas} dia={dia} />

        <Bloque id="cifras" titulo="Cifras del día" pregunta="¿Cómo vamos hoy?" fuente={FUENTES.cifras}>
          <CifrasClave programas={programas} definirObjetivo={definirObjetivo} />
          {programas.length > 1 ? <TotalDelDia programas={programas} /> : null}
        </Bloque>

        <Bloque id="embudo" titulo="Del lead a la venta" pregunta="¿Cuántos leads llegan a una cita, a asistir y a comprar?" fuente={FUENTES.embudo}>
          <EmbudoDelDia programas={programas} />
        </Bloque>

        <Bloque id="dinero" titulo="Dinero del día" pregunta="¿Cuánto se vendió y de dónde salió la caja?" fuente={FUENTES.dinero}>
          <DineroDelDia programas={programas} veEquipo={veEquipo} />
        </Bloque>

        <Bloque id="citas" titulo="Citas del día" pregunta="¿Qué pasó con cada cita?" fuente={FUENTES.citas}>
          <CitasDelDia programas={programas} veEquipo={veEquipo} />
        </Bloque>

        {pendientes ? (
          <Bloque id="pendientes" titulo="Alertas y pendientes" pregunta="¿Qué pide atención ahora?" fuente={FUENTES.pendientes}>
            {pendientes}
          </Bloque>
        ) : null}

        <Bloque id="semana" titulo="La semana" pregunta="¿Vamos al ritmo del objetivo de la semana?" fuente={FUENTES.semana}>
          <SemanaEnCurso programas={programas} />
        </Bloque>

        <Bloque id="objetivos" titulo="Objetivos del mes y la cohorte" fuente={FUENTES.objetivos}>
          <div className="no-partir">{vamosALlegar}</div>
        </Bloque>
      </div>
    </section>
  );
}
