import { CifraConLista } from "@/components/cifra-con-lista";
import { SeriesLineales } from "@/components/series-lineales";
import { Variacion } from "@/components/variacion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct } from "@/lib/format";
import type { PuntoHabil } from "@/lib/queries/deals-contra-agendas";
import type { VistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { porcentajeConBase, textoDeVariacionDeTasa } from "@/lib/variacion";

const TITULO = "Deals creados contra agendas";

/**
 * La gráfica del ticket 138: acumulado por día hábil de deals creados y agendas creadas, A
 * contra B, y la razón agendas por deal aparte (una tasa no comparte eje con un conteo). Solo
 * pinta lo que calculó `vistaDealsContraAgendas`.
 */
export function DealsContraAgendas({ vista }: { vista: VistaDealsContraAgendas }) {
  if (!vista.disponible) {
    return (
      <Card aria-labelledby="deals-contra-agendas">
        <CardHeader>
          <CardTitle id="deals-contra-agendas">{TITULO}</CardTitle>
          <CardDescription>
            Generar deals y agendas es del programa, no de un closer: quita el filtro de closer para verla.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { periodo, nota, a, b, detalles } = vista;
  const finalA = a.puntos.at(-1);
  const finalB = b?.puntos.at(-1);
  const largo = Math.max(a.puntos.length, b?.puntos.length ?? 0);
  const posiciones = Array.from({ length: largo }, (_, i) => i);
  const valores = (puntos: PuntoHabil[], campo: (p: PuntoHabil) => number | null) =>
    posiciones.map((i) => (puntos[i] ? campo(puntos[i]) : null));
  const etiquetas = posiciones.map((i) => `Hábil ${i + 1}`);
  const rangoDe = (r: { desde: string; hasta: string }) => `${fecha(r.desde)} a ${fecha(r.hasta)}`;

  return (
    <Card aria-labelledby="deals-contra-agendas">
      <CardHeader>
        <CardTitle id="deals-contra-agendas">{TITULO}</CardTitle>
        <CardDescription>
          Acumulado por día hábil. A: {rangoDe(periodo.a)}
          {periodo.b ? ` · B: ${rangoDe(periodo.b)}` : " · sin B"}. Si los deals suben y las agendas no,
          los leads que entran no están agendando.
        </CardDescription>
        {nota ? <p role="status" className="text-xs text-muted-foreground">{nota}</p> : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="py-2 font-medium" />
                <th className="py-2 text-right font-medium">A · hábil {num(a.puntos.length)}</th>
                <th className="py-2 text-right font-medium">B · hábil {num(b?.puntos.length ?? 0)}</th>
                <th className="py-2 text-right font-medium">B → A</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2">Deals creados</td>
                <td className="cifra text-right">
                  <CifraConLista titulo="Deals creados" detalle={detalles.deals_creados}>
                    {num(finalA?.deals ?? 0)}
                  </CifraConLista>
                </td>
                <td className="cifra text-right">{finalB ? num(finalB.deals) : "—"}</td>
                <td className="text-right">
                  {finalB ? <Variacion actual={finalA?.deals ?? 0} anterior={finalB.deals} /> : "—"}
                </td>
              </tr>
              <tr>
                <td className="py-2">Agendas creadas</td>
                <td className="cifra text-right">
                  <CifraConLista titulo="Agendas creadas" detalle={detalles.agendas_creadas}>
                    {num(finalA?.agendas ?? 0)}
                  </CifraConLista>
                </td>
                <td className="cifra text-right">{finalB ? num(finalB.agendas) : "—"}</td>
                <td className="text-right">
                  {finalB ? <Variacion actual={finalA?.agendas ?? 0} anterior={finalB.agendas} /> : "—"}
                </td>
              </tr>
              <tr>
                <td className="py-2">Agendas por deal</td>
                <td className="cifra text-right">{porcentajeConBase(finalA?.agendas ?? 0, finalA?.deals ?? 0)}</td>
                <td className="cifra text-right">
                  {finalB ? porcentajeConBase(finalB.agendas, finalB.deals) : "—"}
                </td>
                <td className="cifra text-right">
                  {finalB ? textoDeVariacionDeTasa(finalA?.razon ?? null, finalB.razon) : "—"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <SeriesLineales
          titulo="Acumulado"
          unidad="registros"
          etiquetas={etiquetas}
          datos={{
            dias: etiquetas,
            series: [
              { clave: "Deals · A", color: 0, valores: valores(a.puntos, (p) => p.deals) },
              { clave: "Agendas · A", color: 1, valores: valores(a.puntos, (p) => p.agendas) },
              ...(b
                ? [
                    { clave: "Deals · B", color: 0, punteada: true, valores: valores(b.puntos, (p) => p.deals) },
                    { clave: "Agendas · B", color: 1, punteada: true, valores: valores(b.puntos, (p) => p.agendas) },
                  ]
                : []),
            ],
          }}
        />
        <SeriesLineales
          titulo="Agendas por deal"
          unidad="% acumulado"
          etiquetas={etiquetas}
          formato={(v) => pct(v, 0)}
          datos={{
            dias: etiquetas,
            series: [
              { clave: "A", color: 2, valores: valores(a.puntos, (p) => p.razon) },
              ...(b ? [{ clave: "B", color: 2, punteada: true, valores: valores(b.puntos, (p) => p.razon) }] : []),
            ],
          }}
        />
      </CardContent>
    </Card>
  );
}
