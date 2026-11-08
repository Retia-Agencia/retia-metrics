import { CifraConLista } from "@/components/cifra-con-lista";
import { Card, CardContent } from "@/components/ui/card";
import { tasa } from "@/components/dashboard/piezas";
import { Lado } from "@/components/dashboard/hoy/comunes";
import type { ProgramaDelReporte } from "@/components/dashboard/hoy/tipos";
import { EmbudoDeBarras } from "@/components/graficas/barras";
import { num } from "@/lib/format";
import { nombreCorto, nombreLargo } from "@/lib/vocabulario-metricas";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";

/** Una tasa con su cuenta a la vista y su lista: "Asistencia 46 % · 18 de 39 citas". */
function Tasa({ titulo, valor, cuenta, detalle }: { titulo: string; valor: number | null; cuenta: string; detalle?: DetalleDeCifra }) {
  return (
    <div className="rounded-lg bg-muted px-3 py-2">
      <div className="text-xs text-muted-foreground">{titulo}</div>
      <div className="cifra text-xl font-semibold"><CifraConLista titulo={titulo} detalle={detalle}>{tasa(valor)}</CifraConLista></div>
      <div className="text-xs text-muted-foreground">{cuenta}</div>
    </div>
  );
}

/**
 * Del lead a la venta (378): las dos tasas arriba, con su cuenta, y las barras debajo. El 100 % de las
 * barras es el paso más grande y la pantalla lo dice con su cifra.
 */
export function EmbudoDelDia({ programas }: { programas: ProgramaDelReporte[] }) {
  return (
    <Lado programas={programas}>{({ reporte, detalles, detalleRegistros }) => {
      const e = reporte.vista.embudo;
      const pasos = [
        { clave: "leads", etiqueta: nombreCorto("registros"), cantidad: reporte.registros, detalle: detalleRegistros },
        { clave: "citas", etiqueta: nombreCorto("citas_del_dia"), cantidad: e.agendas, detalle: detalles?.agendas },
        { clave: "realizadas", etiqueta: nombreCorto("citas_realizadas"), cantidad: e.llamadasConShow, detalle: detalles?.shows },
        { clave: "ventas", etiqueta: nombreCorto("cupos_vendidos"), cantidad: e.cierres, detalle: detalles?.cierres },
      ];
      const mayor = pasos.reduce((m, p) => (p.cantidad > m.cantidad ? p : m), pasos[0]);
      return (
        <Card className="no-partir">
          <CardContent className="space-y-4">
            <div className="max-w-sm">
              <Tasa
                titulo={nombreLargo("cierre_de_ventas")}
                valor={e.pctCierre}
                cuenta={`${num(e.grupo.vendidos)} de ${num(e.grupo.conShow)} personas que asistieron`}
                detalle={detalles?.grupo_shows}
              />
            </div>
            <EmbudoDeBarras pasos={pasos} />
            <p className="text-xs text-muted-foreground">
              100 % = la barra más larga ({mayor.etiqueta}: {num(mayor.cantidad)}). Cada barra mide su cantidad contra esa.
              {e.canceladas > 0 ? ` ${num(e.canceladas)} citas canceladas no entran.` : ""}
            </p>
          </CardContent>
        </Card>
      );
    }}</Lado>
  );
}
