import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct } from "@/lib/format";
import { NOMBRE_DE_METRICA_CON_UMBRAL } from "@/lib/catalogo/umbrales";
import type { Alerta } from "@/lib/queries/alertas";

/**
 * Las alertas por persistencia del Pulso (ticket 147, GC-40): una métrica del semáforo de la meta
 * bajo su aceptable N días hábiles cerrados seguidos. Se ve la alerta disparada, la racha que va
 * camino a dispararse, y cada día que la forma con su cumplimiento.
 */
export function Alertas({ alertas, slug }: { alertas: Alerta[]; slug: string }) {
  const configurar = `/p/${encodeURIComponent(slug)}/programa?seccion=ventas`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Alertas por persistencia</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alertas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin umbrales activos en este programa.{" "}
            <Link className="text-primary underline-offset-4 hover:underline" href={configurar}>Configurarlos en Programa</Link>.
          </p>
        ) : (
          alertas.map((alerta) => (
            <div key={alerta.metrica} className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{NOMBRE_DE_METRICA_CON_UMBRAL[alerta.metrica]}</span>
                {alerta.disparada ? (
                  <Badge variant="peligro">
                    {num(alerta.racha)} días hábiles seguidos bajo {pct(alerta.aceptable / 100, 0)}
                  </Badge>
                ) : alerta.racha > 0 ? (
                  <Badge variant="alerta">
                    {num(alerta.racha)} de {num(alerta.diasSeguidos)} días bajo {pct(alerta.aceptable / 100, 0)}
                  </Badge>
                ) : (
                  <Badge variant="exito">Sobre {pct(alerta.aceptable / 100, 0)}</Badge>
                )}
              </div>
              <ul className="flex flex-wrap gap-2 text-xs">
                {alerta.dias.map((d) => {
                  const bajo = d.cumplimiento !== null && d.cumplimiento * 100 < alerta.aceptable;
                  return (
                    <li key={d.dia}>
                      <Badge variant={d.cumplimiento === null ? "neutro" : bajo ? "peligro" : "exito"} className="cifra">
                        {fecha(d.dia)} · {d.cumplimiento === null ? "—" : pct(d.cumplimiento)}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        )}
        <p className="text-xs text-muted-foreground">
          Cumplimiento al cierre de cada día hábil ya terminado: lo vendido hasta ese día contra lo esperado hasta
          ese día. Hoy no cuenta todavía. Un día sin ventana de venta corta la racha.
        </p>
      </CardContent>
    </Card>
  );
}
