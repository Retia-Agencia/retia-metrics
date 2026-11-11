import Link from "next/link";
import { Badge } from "@/components/ui/badge";
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
export const PASOS: { clave: keyof PasosDelFormulario; titulo: string; deLosQue?: string }[] = [
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

/**
 * El detalle del embudo dentro de "¿Dónde se va la gente del formulario?" (420): los pasos del total ya van arriba
 * como Cifras, así que aquí queda lo demás (no agendaron, sin calidad y la tabla por canal), sin tarjeta propia.
 */
export function DetalleDelEmbudoFormulario({ embudo, hrefNoAgendaron }: { embudo: EmbudoDelFormulario; hrefNoAgendaron?: string }) {
  return <div className="space-y-5 text-sm">
    <NoAgendaron embudo={embudo} hrefNoAgendaron={hrefNoAgendaron} />
    <SinCalidad embudo={embudo} />
    <TablaPorCanal embudo={embudo} />
  </div>;
}

function NoAgendaron({ embudo, hrefNoAgendaron }: { embudo: EmbudoDelFormulario; hrefNoAgendaron?: string }) {
  const { noAgendaron } = embudo;
  return (
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
  );
}

function SinCalidad({ embudo }: { embudo: EmbudoDelFormulario }) {
  const { sinCalidad } = embudo;
  return sinCalidad > 0 ? (
          <p className="text-xs text-muted-foreground">
            <span className="cifra">{num(sinCalidad)}</span> registros no traen calidad (llegaron antes de que el formulario la
            mandara) y no agendaron: no se sabe si vieron el Calendly, así que no cuentan en ese paso.
          </p>
        ) : null;
}

function TablaPorCanal({ embudo }: { embudo: EmbudoDelFormulario }) {
  const { filas } = embudo;
  return (
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
  );
}
