import { CifraConLista } from "@/components/cifra-con-lista";
import { Grafica } from "@/components/graficas/grafica";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct } from "@/lib/format";
import { descripcionDeComparacion } from "@/lib/periodo";
import type { PuntoHabil } from "@/lib/queries/deals-contra-agendas";
import type { VistaDealsContraAgendas } from "@/lib/queries/vista-deals-contra-agendas";
import { cambioDeTasaEnPalabras, cambioEnPalabras } from "@/lib/variacion";
import { ContextoDeCifra } from "@/components/dashboard/contexto-de-cifra";
import { nombreLargo } from "@/lib/vocabulario-metricas";

const TITULO = "Deals creados contra agendas";

/** "19 oct": el año ya lo dice el periodo. */
const diaCorto = (dia: string) => fecha(dia).replace(/ \d{4}$/, "");

/**
 * La gráfica del ticket 138: acumulado de deals creados y agendas creadas, A contra B al mismo día
 * hábil, y aparte qué parte de los deals agendó (A-167: una tasa no comparte eje con un conteo).
 * El eje lleva las fechas del periodo; la comparación se corta en el mismo hábil. Solo pinta lo
 * que calculó `vistaDealsContraAgendas`.
 */
export function DealsContraAgendas({ vista, contexto }: { vista: VistaDealsContraAgendas; contexto?: string }) {
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

  const { periodo, nota, a, b, detalles, porOrigen } = vista;
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
  // Cada mitad con sus propios deals: la tasa de una no se mezcla con la de la otra (N2, ticket 372).
  const mitad = (origen: "completo" | "parcial") => {
    const puntosA = porOrigen[origen].a.puntos;
    const puntosDeB = porOrigen[origen].b?.puntos.slice(0, a.puntos.length) ?? [];
    return { puntosA, puntosB: puntosDeB, a: puntosA.at(-1), b: puntosDeB.at(-1) };
  };
  const completo = mitad("completo");
  const parcial = mitad("parcial");
  const aMano = (total: number | undefined, c: number | undefined, p: number | undefined) =>
    Math.max(0, (total ?? 0) - (c ?? 0) - (p ?? 0));
  const aManoA = aMano(finalA?.deals, completo.a?.deals, parcial.a?.deals);
  const aManoB = finalB ? aMano(finalB.deals, completo.b?.deals, parcial.b?.deals) : null;
  const filaDeals = (rotulo: string, detalle: typeof detalles.deals_creados | undefined, ahora: number, antes: number | null, titulo: string) => (
    <tr>
      <td className="py-2">{rotulo}</td>
      <td className="cifra text-right">
        <CifraConLista titulo={titulo} detalle={detalle}>{num(ahora)}</CifraConLista>
      </td>
      <td className="cifra text-right">{antes === null ? "—" : num(antes)}</td>
      <td className="text-right">{antes === null ? "—" : cambioEnPalabras(ahora, antes)}</td>
    </tr>
  );
  const filaTasa = (rotulo: string, ahora: number | null | undefined, antes: number | null | undefined, hayB: boolean) => (
    <tr>
      <td className="py-2">{rotulo}</td>
      <td className="cifra text-right">{ahora == null ? "—" : pct(ahora, 0)}</td>
      <td className="cifra text-right">{antes == null ? "—" : pct(antes, 0)}</td>
      <td className="text-right">{hayB ? cambioDeTasaEnPalabras(ahora ?? null, antes ?? null) : "—"}</td>
    </tr>
  );

  return (
    <Card aria-labelledby="deals-contra-agendas">
      <CardHeader>
        <CardTitle id="deals-contra-agendas">{TITULO}</CardTitle>
        <CardDescription>
          {rangoDe(periodo.a)}
          {periodo.b ? `, contra ${rangoDe(periodo.b)}` : ""}. Si los deals suben y las agendas no, los leads que
          entran no están agendando.
        </CardDescription>
        {contexto ? <ContextoDeCifra texto={contexto} /> : null}
        {nota ? <p role="status" className="text-sm text-muted-foreground">{nota}</p> : null}
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-base">
          <span className="cifra text-2xl font-semibold">{completo.a?.pctAgendaron == null ? "—" : pct(completo.a.pctAgendaron, 0)}</span>{" "}
          de{" "}
          <CifraConLista titulo={nombreLargo("deals_desde_completo")} detalle={detalles.deals_desde_completo}>{num(completo.a?.deals ?? 0)}</CifraConLista>{" "}
          deals de los que llenaron el formulario completo agendó (
          <CifraConLista titulo="Deals de un formulario completo que agendaron" detalle={detalles.completos_que_agendaron}>{num(completo.a?.agendaron ?? 0)}</CifraConLista>
          {" "}con al menos una agenda). Un parcial casi nunca agenda: va aparte.
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
              {filaDeals("Deals creados", detalles.deals_creados, deals, finalB ? finalB.deals : null, "Deals creados")}
              {filaDeals("· desde un formulario completo", detalles.deals_desde_completo, completo.a?.deals ?? 0, finalB ? (completo.b?.deals ?? 0) : null, nombreLargo("deals_desde_completo"))}
              {filaDeals("· desde un parcial", detalles.deals_desde_parcial, parcial.a?.deals ?? 0, finalB ? (parcial.b?.deals ?? 0) : null, nombreLargo("deals_desde_parcial"))}
              {aManoA > 0 || (aManoB ?? 0) > 0 ? filaDeals("· abiertos a mano, sin formulario", undefined, aManoA, aManoB, "Deals abiertos a mano") : null}
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
              {filaTasa("% que agendaron, de los que llenaron el formulario completo", completo.a?.pctAgendaron, completo.b?.pctAgendaron, !!finalB)}
              {filaTasa("% que agendaron, de los parciales", parcial.a?.pctAgendaron, parcial.b?.pctAgendaron, !!finalB)}
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
          titulo="% que agendaron, completos y parciales"
          unidad="% acumulado"
          frescura={`Datos hasta ${fecha(a.puntos.at(-1)?.dia ?? periodo.a.hasta)}.`}
          etiquetas={etiquetas}
          formato={(v) => pct(v, 0)}
          comparacion={b ? {
            texto: descripcionDeComparacion(periodo),
            pares: [
              { actual: "Formulario completo · periodo", referencia: "Formulario completo · comparación" },
              { actual: "Parcial · periodo", referencia: "Parcial · comparación" },
            ],
          } : undefined}
          datos={{
            dias,
            series: [
              { clave: "Formulario completo · periodo", color: 2, valores: valores(completo.puntosA, (p) => p.pctAgendaron) },
              { clave: "Parcial · periodo", color: 3, valores: valores(parcial.puntosA, (p) => p.pctAgendaron) },
              ...(b
                ? [
                    { clave: "Formulario completo · comparación", color: 2, punteada: true, valores: valores(completo.puntosB, (p) => p.pctAgendaron) },
                    { clave: "Parcial · comparación", color: 3, punteada: true, valores: valores(parcial.puntosB, (p) => p.pctAgendaron) },
                  ]
                : []),
            ],
          }}
        />
      </CardContent>
    </Card>
  );
}
