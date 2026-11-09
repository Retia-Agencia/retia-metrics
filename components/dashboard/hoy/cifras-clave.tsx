import type { ReactNode } from "react";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Caja } from "@/components/dashboard/piezas";
import { EnlaceAInfo } from "@/components/hub/info-de-pagina";
import { CuentaDeAsistencia, Ficha, Lado, cumplimiento } from "@/components/dashboard/hoy/comunes";
import { BarraDeAvance } from "@/components/hub/barra-de-avance";
import type { ProgramaDelReporte } from "@/components/dashboard/hoy/tipos";
import { num } from "@/lib/format";
import { metaDeLeads } from "@/lib/queries/proyeccion";
import { nombreCorto, nombreLargo } from "@/lib/vocabulario-metricas";
import { CifraDeRazon } from "@/components/cifra-de-razon";
import { pct } from "@/lib/format";

/**
 * Las cuatro cifras de entrada de Hoy (378). Cada una abre su lista y dice contra qué se mide: si el
 * objetivo no está puesto, la tarjeta lo dice y ofrece definirlo (solo a quien administra).
 */
function SinObjetivo({ texto, definir }: { texto: string; definir?: ReactNode }) {
  return <div className="text-xs text-muted-foreground"><p>{texto}</p>{definir}</div>;
}

export function CifrasClave({ programas, definirObjetivo }: { programas: ProgramaDelReporte[]; definirObjetivo?: ReactNode }) {
  return (
    <Lado programas={programas}>{({ reporte, detalles, leadsDelDia, detalleRegistros }) => {
      const dia = reporte.horizontes.find((h) => h.clave === "dia")!;
      const objetivoDeLeads = metaDeLeads(reporte.proyeccion.cohorte);
      const hacenFalta = reporte.proyeccion.leadsRequeridosDia.valor;
      const leads = leadsDelDia ?? 0;
      // DA-3 (353): la cifra de Hoy es el % de show POR DEAL; el de por cita vive en "Cómo se calcula".
      const grupo = reporte.vista.embudo.grupo;
      return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print:grid-cols-2">
          <Ficha
            titulo={nombreCorto("cupos_vendidos")}
            ayuda="cifras"
            valor={<CifraConLista titulo={nombreLargo("cupos_vendidos")} detalle={detalles?.cierres}>{num(dia.real)}</CifraConLista>}
          >
            {dia.meta === null
              ? <SinObjetivo texto="Sin objetivo del día: la cohorte no tiene ventana de ventas." definir={definirObjetivo} />
              : <>
                <BarraDeAvance llevamos={dia.real} objetivo={dia.meta} />
                <p className="text-xs text-muted-foreground">{nombreCorto("objetivo_del_dia")}: {num(dia.meta, 1)} · llevas el {cumplimiento(dia.real, dia.meta)}</p>
              </>}
          </Ficha>

          <Ficha
            titulo="Leads de hoy"
            ayuda="cifras"
            valor={<CifraConLista titulo="Leads de hoy" detalle={detalleRegistros}>{num(leads)}</CifraConLista>}
          >
            {objetivoDeLeads === null
              ? <SinObjetivo texto="Sin objetivo de leads por día." definir={definirObjetivo} />
              : <>
                <BarraDeAvance llevamos={leads} objetivo={objetivoDeLeads} />
                <p className="text-xs text-muted-foreground">{nombreCorto("objetivo_de_leads")}: {num(objetivoDeLeads, 0)} por día · llevas el {cumplimiento(leads, objetivoDeLeads)}</p>
              </>}
            <p className="flex items-center gap-1 border-t pt-2 text-xs text-muted-foreground">
              <span>{nombreCorto("leads_que_hacen_falta")}: <span className="cifra font-medium text-foreground">{hacenFalta === null ? "—" : `${num(hacenFalta, 0)} por día`}</span></span>
              <EnlaceAInfo seccion="leads-que-hacen-falta" etiqueta={nombreCorto("leads_que_hacen_falta")} />
            </p>
          </Ficha>

          <Ficha
            titulo="Entró a caja hoy"
            ayuda="dinero"
            valor={<CifraConLista titulo="Entró a caja del día" detalle={detalles?.caja}><Caja caja={reporte.caja.length ? reporte.caja : [{ moneda: "USD", total: 0 }]} /></CifraConLista>}
          >
            <p className="text-xs text-muted-foreground">Abonos de hoy, por su moneda.</p>
          </Ficha>

          <Ficha
            titulo={nombreLargo("asistencia")}
            ayuda="embudo"
            valor={<CifraConLista titulo="Personas con cita que ya ocurrió" detalle={detalles?.grupo_citas}><CifraDeRazon razon={reporte.vista.embudo.razonShow} formato={pct} /></CifraConLista>}
          >
            <p className="text-xs text-muted-foreground"><CuentaDeAsistencia asistieron={grupo.conShow} personas={grupo.deals} sinMarcar={grupo.sinMarcar} detalle={detalles?.grupo_pendientes} /></p>
          </Ficha>
        </div>
      );
    }}</Lado>
  );
}
