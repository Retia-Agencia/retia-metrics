import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct } from "@/lib/format";
import type { FilaUrgencias, Semaforo, VistaUrgencias } from "@/lib/queries/urgencias";

/**
 * La réplica de `🚨 Urgencias` (ticket 066). Pinta lo que calculó `urgenciasDelPrograma`; no
 * calcula métricas. Los huérfanos salen siempre, con conteo y %, aunque estén en cero.
 */

const HUERFANO: Record<Exclude<FilaUrgencias["origen"], "canal">, { texto: string; variante: "neutro" | "alerta" }> = {
  sin_clasificar: { texto: "Sin clasificar", variante: "alerta" },
  sin_utm: { texto: "Sin UTM", variante: "neutro" },
  sin_envio_origen: { texto: "Sin envío de origen", variante: "neutro" },
};

const SEMAFORO: Record<Semaforo, string> = {
  exito: "En ruta",
  alerta: "Atento",
  peligro: "Atrasado",
};

function delDia(cantidad: number, total: number): string {
  return total === 0 ? "—" : pct(cantidad / total);
}

export function TarjetaUrgencias({ vista }: { vista: VistaUrgencias }) {
  const { dia, ventana, agendas, registros, promedioAgendas, semaforo, filas } = vista;
  return (
    <Card aria-labelledby="urgencias">
      <CardHeader className="space-y-1">
        <CardTitle id="urgencias" className="text-base">
          Urgencias · {fecha(dia)}
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Las agendas del día hábil anterior contra el promedio de los {num(ventana.length)} días hábiles previos (
          {fecha(ventana[0])} a {fecha(ventana[ventana.length - 1])}). Una agenda es una llamada creada ese día, del
          canal del envío que abrió su deal.
        </p>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="grid gap-4 sm:grid-cols-4">
          <Kpi etiqueta="Agendas del día" valor={num(agendas)} />
          <Kpi etiqueta="Promedio por día hábil" valor={num(promedioAgendas, 1)} />
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Semáforo</div>
            {semaforo ? (
              <Badge variant={semaforo}>{SEMAFORO[semaforo]}</Badge>
            ) : (
              <p className="text-muted-foreground">Sin agendas en los días previos: no hay contra qué comparar.</p>
            )}
          </div>
          <Kpi etiqueta="Registros del día" valor={num(registros)} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Canal</th>
                <th className="py-2 pl-3 font-medium">Área</th>
                <th className="py-2 pl-3 text-right font-medium">Agendas</th>
                <th className="py-2 pl-3 text-right font-medium">% del día</th>
                <th className="py-2 pl-3 text-right font-medium">Promedio</th>
                <th className="py-2 pl-3 text-right font-medium">Registros</th>
              </tr>
            </thead>
            <tbody className="divide-y [&_tr]:transition-colors [&_tr]:duration-150 [&_tr:hover]:bg-muted/40">
              {filas.map((f) => (
                <tr key={f.canalId ?? f.origen}>
                  <td className="py-2 pr-3">
                    {f.origen === "canal" ? (
                      f.canal
                    ) : (
                      <Badge variant={HUERFANO[f.origen].variante}>{HUERFANO[f.origen].texto}</Badge>
                    )}
                  </td>
                  <td className="py-2 pl-3 text-muted-foreground">{f.area ?? "—"}</td>
                  <td className="cifra py-2 pl-3 text-right">{num(f.agendas)}</td>
                  <td className="cifra py-2 pl-3 text-right text-muted-foreground">{delDia(f.agendas, agendas)}</td>
                  <td className="cifra py-2 pl-3 text-right text-muted-foreground">{num(f.promedioAgendas, 1)}</td>
                  <td className="cifra py-2 pl-3 text-right">{num(f.registros)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t font-medium">
                <td className="py-2 pr-3">Total</td>
                <td />
                <td className="cifra py-2 pl-3 text-right">{num(agendas)}</td>
                <td className="cifra py-2 pl-3 text-right text-muted-foreground">{agendas === 0 ? "—" : pct(1)}</td>
                <td className="cifra py-2 pl-3 text-right text-muted-foreground">{num(promedioAgendas, 1)}</td>
                <td className="cifra py-2 pl-3 text-right">{num(registros)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Kpi({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="space-y-1">
      <div className="text-xs text-muted-foreground">{etiqueta}</div>
      <div className="cifra text-2xl font-semibold">{valor}</div>
    </div>
  );
}
