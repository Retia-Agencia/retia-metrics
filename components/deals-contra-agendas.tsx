import { Grafica } from "@/components/graficas/grafica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num } from "@/lib/format";
import { InterruptoresDeGrafica } from "@/components/graficas/interruptores";
import { descripcionDeComparacion } from "@/lib/periodo";
import type { PuntoHabil } from "@/lib/queries/deals-contra-agendas";
import {
  configDeGraficaEnOrigen,
  etiquetaDeTramo,
  indicesDeTramos,
  pasoPorDefecto,
  tramosDe,
  valoresDeAcumulado,
} from "@/lib/series-pasos";
import type { VistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { EnlaceAInfo } from "@/components/hub/info-de-pagina";

const TITULO = "¿Generamos deals que agendan?";

/**
 * La gráfica del ticket 138: acumulado de deals creados y agendas creadas, A contra B al mismo día
 * hábil, y aparte qué parte de los deals agendó (A-167: una tasa no comparte eje con un conteo).
 * El eje lleva las fechas del periodo; la comparación se corta en el mismo hábil. Solo pinta lo
 * que calculó `vistaDealsContraAgendas`.
 */
export function DealsContraAgendas({
  vista,
  origen,
  hoy,
}: {
  vista: VistaDealsContraAgendas;
  /** Con URL se ofrecen Paso y Forma (370); sin ella, la vista de todos queda acumulada por hábil. */
  origen?: string;
  hoy?: string;
}) {
  if (!vista.disponible) {
    return (
      <Card aria-labelledby="deals-contra-agendas">
        <CardHeader>
          <CardTitle id="deals-contra-agendas" className="flex items-center gap-1.5">{TITULO}<EnlaceAInfo seccion="deals-agendas" etiqueta={TITULO} /></CardTitle>
          <CardDescription>Disponible solo sin filtro de closer.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { periodo, nota, a, b } = vista;
  // B se lee al mismo día hábil que A (ADR 0067): más allá sería comparar contra un futuro.
  const puntosB = b?.puntos.slice(0, a.puntos.length) ?? [];
  // Paso y Forma (370). Por defecto, por paso: la actividad se lee como "cuántos entraron en cada tramo".
  const config = origen
    ? configDeGraficaEnOrigen(origen, "deals-agendas", {
        unidad: "cupos",
        paso: pasoPorDefecto(periodo.a),
        forma: "paso",
      })
    : { unidad: "cupos" as const, paso: "dia" as const, forma: "acum" as const };
  const diasDePuntos = a.puntos.map((p) => p.dia);
  const todosLosTramos = tramosDe(periodo.a, config.paso, hoy ?? periodo.a.hasta);
  const todosLosIndices = indicesDeTramos(diasDePuntos, todosLosTramos);
  // Un fin de semana no tiene punto propio (entra al hábil siguiente): por día solo van los tramos con punto nuevo.
  const tramos = todosLosTramos.filter(
    (_, k) => config.paso !== "dia" || todosLosIndices[k] !== (todosLosIndices[k - 1] ?? -2),
  );
  const indices = indicesDeTramos(diasDePuntos, tramos);
  const dias = tramos.map((tramo) => tramo.desde);
  const etiquetas = tramos.map(etiquetaDeTramo);
  const valoresDe = (puntos: PuntoHabil[], campo: (p: PuntoHabil) => number) =>
    valoresDeAcumulado(a.puntos.map((_, i) => (puntos[i] ? campo(puntos[i]) : null)), indices, config.forma);
  const forma = config.forma === "acum" ? "acumulado" : `por ${config.paso === "dia" ? "día hábil" : config.paso}`;

  return (
    <Card aria-labelledby="deals-contra-agendas">
      <CardHeader>
        <CardTitle id="deals-contra-agendas" className="flex items-center gap-1.5 text-base">
          {TITULO}<EnlaceAInfo seccion="deals-agendas" etiqueta={TITULO} />
        </CardTitle>
        {nota ? <p role="status" className="text-sm text-muted-foreground">{nota}</p> : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {origen ? (
          <InterruptoresDeGrafica origen={origen} clave="deals-agendas" config={config} sinUnidad />
        ) : null}
        <Grafica
          titulo={`Deals y agendas ${forma}`}
          unidad="deals y agendas"
          frescura={
            `Datos hasta ${fecha(a.puntos.at(-1)?.dia ?? periodo.a.hasta)}. ` +
            "Son conteos de personas y citas, no plata."
          }
          etiquetas={etiquetas}
          formato={(v) => num(v)}
          comparacion={
            b
              ? {
                  texto: descripcionDeComparacion(periodo),
                  pares: [
                    { actual: "Deals · periodo", referencia: "Deals · comparación" },
                    { actual: "Agendadas · periodo", referencia: "Agendadas · comparación" },
                  ],
                }
              : undefined
          }
          datos={{
            dias,
            series: [
              { clave: "Deals · periodo", color: 0, valores: valoresDe(a.puntos, (p) => p.deals) },
              { clave: "Agendadas · periodo", color: 1, valores: valoresDe(a.puntos, (p) => p.agendas) },
              ...(b
                ? [
                    {
                      clave: "Deals · comparación",
                      color: 0,
                      punteada: true,
                      valores: valoresDe(puntosB, (p) => p.deals),
                    },
                    {
                      clave: "Agendadas · comparación",
                      color: 1,
                      punteada: true,
                      valores: valoresDe(puntosB, (p) => p.agendas),
                    },
                  ]
                : []),
            ],
          }}
          tablaSoloLectores
        />
      </CardContent>
    </Card>
  );
}
