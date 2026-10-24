import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct } from "@/lib/format";
import {
  tasasDelEmbudo,
  type EmbudoDelFormulario,
  type FilaEmbudoFormulario,
  type PasosDelFormulario,
} from "@/lib/queries/embudo-formulario";

/**
 * El embudo del formulario por canal (ticket 126, parte A). Pinta lo que calculó
 * `embudoDelFormulario` y `tasasDelEmbudo`; no calcula métricas. Cada paso va con su número,
 * su tasa sobre el paso anterior y su tasa sobre "dejó datos" de la misma fila (ADR 0067).
 * El embudo por pregunta (Insights de Typeform) es la parte B.
 */

/** `deLosQue` nombra el paso anterior, para que el % diga sobre qué se calcula. */
const PASOS: { clave: keyof PasosDelFormulario; titulo: string; deLosQue?: string }[] = [
  { clave: "dejoDatos", titulo: "Dejó datos" },
  { clave: "completo", titulo: "Completó", deLosQue: "de los que dejaron datos" },
  { clave: "llegoCalendly", titulo: "Llegó al Calendly", deLosQue: "de los que completaron" },
  { clave: "agendo", titulo: "Agendó", deLosQue: "de los que llegaron al Calendly" },
];

function porcentaje(tasa: number | null): string {
  return tasa === null ? "—" : pct(tasa);
}

function Origen({ fila }: { fila: FilaEmbudoFormulario }) {
  if (fila.origen === "sin_utm") return <Badge variant="neutro">Sin UTM</Badge>;
  return <>{fila.canal}</>;
}

export function EmbudoFormulario({ embudo, hrefNoAgendaron }: { embudo: EmbudoDelFormulario; hrefNoAgendaron?: string }) {
  const { total, filas, sinCalidad, noAgendaron } = embudo;
  const tasasTotales = tasasDelEmbudo(total);
  return (
    <Card aria-labelledby="embudo-formulario">
      <CardHeader className="space-y-1">
        <CardTitle id="embudo-formulario" className="text-base">
          Embudo del formulario
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Por registro (un parcial y su completa cuentan una vez) y por el día de su primer envío. Llegó al Calendly: agendó,
          o el formulario lo calificó High. No aplica el filtro de closer. En la tabla, cada % es sobre la columna anterior.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 text-sm">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {PASOS.map((p) => {
            const tasas = p.clave === "dejoDatos" ? null : tasasTotales[p.clave];
            return (
              <div key={p.clave}>
                <p className="text-xs text-muted-foreground">{p.titulo}</p>
                <p className="cifra text-lg font-semibold">{num(total[p.clave])}</p>
                {tasas === null ? null : (
                  <>
                    <p className="text-xs">
                      <span className="cifra">{porcentaje(tasas.sobreAnterior)}</span> {p.deLosQue}
                    </p>
                    {/* En Completó el paso anterior ya es Dejó datos: el % del total sería el mismo. */}
                    {p.clave === "completo" ? null : (
                      <p className="text-xs text-muted-foreground">
                        <span className="cifra">{porcentaje(tasas.sobreDejoDatos)}</span> del total
                      </p>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-1 border-t pt-4">
          <p className="text-xs text-muted-foreground">No agendaron</p>
          {hrefNoAgendaron ? (
            <Link className="cifra inline-block text-lg font-semibold underline underline-offset-4" href={hrefNoAgendaron}>
              {num(noAgendaron)}
            </Link>
          ) : (
            <p className="cifra text-lg font-semibold">{num(noAgendaron)}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Llegaron al Calendly y hoy no tienen cita vigente ni están en Agendado o una etapa posterior. Es la foto de
            hoy, no la del envío: no tiene por qué dar Llegó al Calendly − Agendó.
          </p>
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
              {filas.map((f) => {
                const tasasDeFila = tasasDelEmbudo(f);
                return (
                  <tr key={f.origen === "canal" ? `${f.area}:${f.canalClave ?? ""}` : f.origen}>
                    <td className="py-2 pr-3">
                      <Origen fila={f} />
                    </td>
                    {PASOS.map((p) => {
                      const tasas = p.clave === "dejoDatos" ? null : tasasDeFila[p.clave];
                      return (
                        <td key={p.clave} className="py-2 pl-3 text-right whitespace-nowrap">
                          <span className="cifra block">{num(f[p.clave])}</span>
                          {tasas === null ? null : (
                            <span className="cifra block text-xs text-muted-foreground">{porcentaje(tasas.sobreAnterior)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
