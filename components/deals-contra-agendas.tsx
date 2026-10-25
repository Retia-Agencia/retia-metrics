import { CifraConLista } from "@/components/cifra-con-lista";
import { Grafica } from "@/components/graficas/grafica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct } from "@/lib/format";
import { descripcionDeComparacion } from "@/lib/periodo";
import type { PuntoHabil } from "@/lib/queries/deals-contra-agendas";
import type { VistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { cambioDeTasaEnPalabras, cambioEnPalabras } from "@/lib/variacion";

const TITULO = "Deals creados contra agendas";

/** "19 oct": el año ya lo dice el periodo. */
const diaCorto = (dia: string) => fecha(dia).replace(/ \d{4}$/, "");

/**
 * La gráfica del ticket 138: acumulado de deals creados y agendas creadas, A contra B al mismo día
 * hábil, y aparte qué parte de los deals agendó (A-167: una tasa no comparte eje con un conteo).
 * El eje lleva las fechas del periodo; la comparación se corta en el mismo hábil. Solo pinta lo
 * que calculó `vistaDealsContraAgendas`.
 */
export function DealsContraAgendas({ vista }: { vista: VistaDealsContraAgendas }) {
  if (!vista.disponible) {
    return (
      <Card aria-labelledby="deals-contra-agendas">
        <CardHeader>
          <CardTitle id="deals-contra-agendas">{TITULO}</CardTitle>
          <CardDescription>
            Es del programa, no de un closer: quita el filtro de closer para verla.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { periodo, nota, a, b, detalles } = vista;
  const finalA = a.puntos.at(-1);
  // B se lee al mismo día hábil que A (ADR 0067): más allá sería comparar contra un futuro.
  const puntosB = b?.puntos.slice(0, a.puntos.length) ?? [];
  const finalB = puntosB.at(-1);
  const dias = a.puntos.map((p) => p.dia);
  const etiquetas = dias.map(diaCorto);
  const valores = (puntos: PuntoHabil[], campo: (p: PuntoHabil) => number | null) =>
    a.puntos.map((_, i) => (puntos[i] ? campo(puntos[i]) : null));
  const rangoDe = (r: { desde: string; hasta: string }) => `${fecha(r.desde)} a ${fecha(r.hasta)}`;
  const deals = finalA?.deals ?? 0;
  const agendaron = finalA?.agendaron ?? 0;

  return (
    <Card aria-labelledby="deals-contra-agendas">
      <CardHeader>
        <CardTitle id="deals-contra-agendas">{TITULO}</CardTitle>
        <CardDescription>
          {rangoDe(periodo.a)}
          {periodo.b ? `, contra ${rangoDe(periodo.b)}` : ""}. Si los deals suben y las agendas no, los leads que
          entran no están agendando.
        </CardDescription>
        {nota ? <p role="status" className="text-sm text-muted-foreground">{nota}</p> : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-base">
          <span className="cifra text-2xl font-semibold">{finalA?.pctAgendaron == null ? "—" : pct(finalA.pctAgendaron, 0)}</span>{" "}
          de{" "}
          <CifraConLista titulo="Deals creados" detalle={detalles.deals_creados}>{num(deals)}</CifraConLista>{" "}
          deals agendó (
          <CifraConLista titulo="Deals que agendaron" detalle={detalles.deals_que_agendaron}>{num(agendaron)}</CifraConLista>
          {" "}con al menos una agenda).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 font-medium" />
                <th className="py-2 text-right font-medium">Periodo</th>
                <th className="py-2 text-right font-medium">Comparación</th>
                <th className="py-2 text-right font-medium">Cambio</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr>
                <td className="py-2">Deals creados</td>
                <td className="cifra text-right">
                  <CifraConLista titulo="Deals creados" detalle={detalles.deals_creados}>{num(deals)}</CifraConLista>
                </td>
                <td className="cifra text-right">{finalB ? num(finalB.deals) : "—"}</td>
                <td className="text-right">{finalB ? cambioEnPalabras(deals, finalB.deals) : "—"}</td>
              </tr>
              <tr>
                <td className="py-2">Agendas creadas</td>
                <td className="cifra text-right">
                  <CifraConLista titulo="Agendas creadas" detalle={detalles.agendas_creadas}>
                    {num(finalA?.agendas ?? 0)}
                  </CifraConLista>
                </td>
                <td className="cifra text-right">{finalB ? num(finalB.agendas) : "—"}</td>
                <td className="text-right">{finalB ? cambioEnPalabras(finalA?.agendas ?? 0, finalB.agendas) : "—"}</td>
              </tr>
              <tr>
                <td className="py-2">% de deals que agendaron</td>
                <td className="cifra text-right">{finalA?.pctAgendaron == null ? "—" : pct(finalA.pctAgendaron, 0)}</td>
                <td className="cifra text-right">{finalB?.pctAgendaron == null ? "—" : pct(finalB.pctAgendaron, 0)}</td>
                <td className="text-right">{finalB ? cambioDeTasaEnPalabras(finalA?.pctAgendaron ?? null, finalB.pctAgendaron) : "—"}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <Grafica
          titulo="Acumulado"
          unidad="registros"
          frescura={`Datos hasta ${fecha(a.puntos.at(-1)?.dia ?? periodo.a.hasta)}.`}
          etiquetas={etiquetas}
          formato={(v) => num(v)}
          comparacion={b ? {
            texto: descripcionDeComparacion(periodo),
            pares: [
              { actual: "Deals · periodo", referencia: "Deals · comparación" },
              { actual: "Agendas · periodo", referencia: "Agendas · comparación" },
            ],
          } : undefined}
          datos={{
            dias,
            series: [
              { clave: "Deals · periodo", color: 0, valores: valores(a.puntos, (p) => p.deals) },
              { clave: "Agendas · periodo", color: 1, valores: valores(a.puntos, (p) => p.agendas) },
              ...(b
                ? [
                    { clave: "Deals · comparación", color: 0, punteada: true, valores: valores(puntosB, (p) => p.deals) },
                    { clave: "Agendas · comparación", color: 1, punteada: true, valores: valores(puntosB, (p) => p.agendas) },
                  ]
                : []),
            ],
          }}
        />
        <Grafica
          titulo="% de deals que agendaron"
          unidad="% acumulado"
          frescura={`Datos hasta ${fecha(a.puntos.at(-1)?.dia ?? periodo.a.hasta)}.`}
          etiquetas={etiquetas}
          formato={(v) => pct(v, 0)}
          comparacion={b ? {
            texto: descripcionDeComparacion(periodo),
            pares: [{ actual: "Periodo", referencia: "Comparación" }],
          } : undefined}
          datos={{
            dias,
            series: [
              { clave: "Periodo", color: 2, valores: valores(a.puntos, (p) => p.pctAgendaron) },
              ...(b ? [{ clave: "Comparación", color: 2, punteada: true, valores: valores(puntosB, (p) => p.pctAgendaron) }] : []),
            ],
          }}
        />
      </CardContent>
    </Card>
  );
}
