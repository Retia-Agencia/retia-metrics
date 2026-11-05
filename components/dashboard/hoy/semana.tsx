import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { tasa } from "@/components/dashboard/piezas";
import { rangoLegible } from "@/components/dashboard/proyeccion";
import { CifraConEnlace, Lado, cumplimiento } from "@/components/dashboard/hoy/comunes";
import { BarraDeAvance } from "@/components/hub/barra-de-avance";
import type { ProgramaDelReporte } from "@/components/dashboard/hoy/tipos";
import { num } from "@/lib/format";
import { metaDeLeads } from "@/lib/queries/proyeccion";
import { nombreCorto } from "@/lib/vocabulario-metricas";

function Fila({ titulo, llevamos, objetivo, nota }: {
  titulo: string;
  llevamos: ReactNode;
  objetivo: { valor: number; llevamos: number; esperado: number } | null;
  nota: ReactNode;
}) {
  return (
    <section aria-label={titulo} className="space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h4 className="text-sm font-medium">{titulo}</h4>
        <p className="text-sm"><span className="text-muted-foreground">{nombreCorto("llevamos")}: </span><span className="cifra text-lg font-semibold">{llevamos}</span></p>
      </div>
      {objetivo ? <BarraDeAvance llevamos={objetivo.llevamos} objetivo={objetivo.valor} esperado={objetivo.esperado} /> : null}
      <p className="text-xs text-muted-foreground">{nota}</p>
    </section>
  );
}

/**
 * La semana (378): lo que llevamos contra el objetivo de la semana y contra lo esperado a hoy. Cada barra
 * dice su objetivo y su raya de "esperado a hoy" con la cifra; y el reparto para llegar a la cohorte
 * ya no es un desplegable.
 */
export function SemanaEnCurso({ programas }: { programas: ProgramaDelReporte[] }) {
  return (
    <Lado programas={programas}>{({ reporte, enlacesDeLaSemana }) => {
      const semana = reporte.horizontes.find((h) => h.clave === "semana")!;
      const { dia, total } = reporte.contexto.semana;
      const esperadoCupos = semana.meta === null || total === 0 ? null : (semana.meta * dia) / total;
      const objetivoDeLeads = metaDeLeads(reporte.proyeccion.cohorte);
      const leads = reporte.leadsDeLaSemana;
      const asistencia = reporte.showDeLaSemana;
      const p = reporte.proyeccion;
      return (
        <Card className="no-partir">
          <CardContent className="space-y-5">
            <p className="text-xs text-muted-foreground">Día {num(dia)} de {num(total)} hábiles de la semana.</p>
            <Fila
              titulo="Cupos vendidos"
              llevamos={<CifraConEnlace href={enlacesDeLaSemana?.cupos}>{num(semana.real)}</CifraConEnlace>}
              objetivo={semana.meta === null || esperadoCupos === null ? null : { valor: semana.meta, llevamos: semana.real, esperado: esperadoCupos }}
              nota={semana.meta === null
                ? "Sin objetivo de la semana: el mes no tiene ventana de ventas."
                : `Objetivo de la semana: ${num(semana.meta, 1)} · esperado a hoy: ${num(esperadoCupos ?? 0, 1)} · avance frente a lo esperado: ${cumplimiento(semana.real, esperadoCupos)}`}
            />
            <Fila
              titulo="Leads"
              llevamos={leads === null ? "—" : <CifraConEnlace href={enlacesDeLaSemana?.leads}>{num(leads)}</CifraConEnlace>}
              objetivo={objetivoDeLeads === null || leads === null ? null : { valor: objetivoDeLeads * total, llevamos: leads, esperado: objetivoDeLeads * dia }}
              nota={objetivoDeLeads === null
                ? "Sin objetivo de leads por día: se define en Configuración."
                : `Objetivo de la semana: ${num(objetivoDeLeads * total, 0)} (${num(objetivoDeLeads, 0)} por día) · esperado a hoy: ${num(objetivoDeLeads * dia, 0)}`}
            />
            <Fila
              titulo={`${nombreCorto("asistencia")} a la cita`}
              llevamos={<CifraConEnlace href={enlacesDeLaSemana?.asistencia}>{tasa(asistencia.porcentaje)}</CifraConEnlace>}
              objetivo={null}
              nota={`${num(asistencia.realizadas)} realizadas de ${num(asistencia.citasQueYaDebianOcurrir)} citas que ya debían ocurrir`}
            />
            {p.cohorte ? (
              <div className="space-y-2 border-t pt-3">
                <h4 className="text-sm font-medium">Cupos por semana para llegar a {num(p.cohorte.metaCupos)} desde mañana</h4>
                <ul className="divide-y text-sm">
                  {p.repartoSemanal.map((t) => (
                    <li key={t.desde} className="flex items-baseline justify-between gap-2 py-1.5">
                      <span>{t.tipo === "resto_semana" ? "Resto de esta semana" : t.tipo === "final" ? "Días sueltos del final" : "Semana"} <span className="text-muted-foreground">({rangoLegible(t.desde, t.hasta)})</span></span>
                      <span className="cifra font-medium">{num(t.ventas, 1)} cupos</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : <p className="border-t pt-3 text-sm text-muted-foreground">Sin cohorte con ventana de ventas.</p>}
          </CardContent>
        </Card>
      );
    }}</Lado>
  );
}
