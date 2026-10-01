import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct } from "@/lib/format";
import type { EmbudoDelFormulario, FilaEmbudoFormulario, PasosDelFormulario } from "@/lib/queries/embudo-formulario";

/**
 * El embudo del formulario por canal (ticket 126, parte A). Pinta lo que calculó
 * `embudoDelFormulario`; no calcula métricas. Cada paso va con su número y su % sobre
 * "dejó datos" de la misma fila (ADR 0067). El embudo por pregunta (Insights de Typeform) es
 * la parte B.
 */

const PASOS: { clave: keyof PasosDelFormulario; titulo: string }[] = [
  { clave: "dejoDatos", titulo: "Dejó datos" },
  { clave: "completo", titulo: "Completó" },
  { clave: "llegoCalendly", titulo: "Llegó al Calendly" },
  { clave: "agendo", titulo: "Agendó" },
];

function porcentaje(parte: number, base: number): string {
  return base === 0 ? "—" : pct(parte / base);
}

function Origen({ fila }: { fila: FilaEmbudoFormulario }) {
  if (fila.origen === "sin_utm") return <Badge variant="neutro">Sin UTM</Badge>;
  if (fila.origen === "sin_clasificar") return <Badge variant="alerta">Sin clasificar</Badge>;
  return <>{fila.canal}</>;
}

export function EmbudoFormulario({ embudo }: { embudo: EmbudoDelFormulario }) {
  const { total, filas, sinCalidad } = embudo;
  return (
    <Card aria-labelledby="embudo-formulario">
      <CardHeader className="space-y-1">
        <CardTitle id="embudo-formulario" className="text-base">
          Embudo del formulario
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Por registro (un parcial y su completa cuentan una vez) y por el día de su primer envío. Llegó al Calendly: agendó,
          o el formulario lo calificó High. No aplica el filtro de closer.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {PASOS.map((p) => (
            <div key={p.clave}>
              <p className="text-xs text-muted-foreground">{p.titulo}</p>
              <p className="cifra text-lg font-semibold">{num(total[p.clave])}</p>
              {p.clave === "dejoDatos" ? null : (
                <p className="cifra text-xs text-muted-foreground">{porcentaje(total[p.clave], total.dejoDatos)}</p>
              )}
            </div>
          ))}
        </div>

        {sinCalidad > 0 ? (
          <p className="text-xs text-muted-foreground">
            <span className="cifra">{num(sinCalidad)}</span> registros no traen calidad (llegaron antes de que el formulario la
            mandara) y no agendaron: no se sabe si vieron el Calendly, así que no cuentan en ese paso.
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium">Canal</th>
                {PASOS.map((p) => (
                  <th key={p.clave} className="py-2 pl-3 text-right font-medium">
                    {p.titulo}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
              {filas.map((f) => (
                <tr key={f.canalId ?? f.origen}>
                  <td className="py-2 pr-3">
                    <Origen fila={f} />
                  </td>
                  {PASOS.map((p) => (
                    <td key={p.clave} className="cifra py-2 pl-3 text-right whitespace-nowrap">
                      {num(f[p.clave])}
                      {p.clave === "dejoDatos" ? null : (
                        <span className="ml-1.5 text-xs text-muted-foreground">{porcentaje(f[p.clave], f.dejoDatos)}</span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
