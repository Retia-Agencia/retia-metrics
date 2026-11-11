import { Badge } from "@/components/ui/badge";
import { fechaHoraEnBogota, num, pct } from "@/lib/format";
import type { EmbudoPorPreguntaDeFuente } from "@/lib/queries/embudo-por-pregunta";

/**
 * El embudo por pregunta de cada formulario de Typeform (ticket 126 parte B). Pinta lo que
 * leyó `embudoPorPregunta`; no calcula métricas. Es el histórico acumulado de Typeform: la
 * API no acepta rango de fechas, así que no sigue el período del dashboard y lo dice.
 * Cada pregunta: cuántos la vieron (y su % sobre quienes vieron la primera) y cuántos se
 * fueron ahí (y su % sobre quienes la vieron).
 */

function porcentaje(parte: number, base: number): string {
  return base === 0 ? "—" : pct(parte / base);
}

function Fuente({ embudo, conNombre }: { embudo: EmbudoPorPreguntaDeFuente; conNombre: boolean }) {
  const titulo = conNombre ? <p className="text-sm font-medium">{embudo.fuente}</p> : null;
  if (embudo.estado === "sin_token") {
    return (
      <div className="space-y-1">
        {titulo}
        <p className="text-xs text-muted-foreground">
          <Badge variant="neutro">Sin token</Badge> Para verlo, carga el token de Typeform de esta fuente en Programa → Captación →
          Formularios.
        </p>
      </div>
    );
  }
  if (embudo.estado === "sin_url") {
    return (
      <div className="space-y-1">
        {titulo}
        <p className="text-xs text-muted-foreground">
          <Badge variant="neutro">Sin URL</Badge> La fuente no tiene la URL del formulario (…typeform.com/to/…), y de ahí
          sale el formulario que se lee.
        </p>
      </div>
    );
  }
  if (embudo.estado === "error") {
    return (
      <div className="space-y-1">
        {titulo}
        <p className="text-xs text-muted-foreground">
          <Badge variant="peligro">No se pudo leer</Badge> {embudo.mensaje}
        </p>
      </div>
    );
  }

  const { insights, leidoEn } = embudo;
  const vistasPrimera = insights.preguntas[0]?.vistas ?? 0;
  return (
    <div className="space-y-3">
      {titulo}
      <p className="text-xs text-muted-foreground">
        <span className="cifra">{num(insights.visitasUnicas)}</span> visitas únicas ·{" "}
        <span className="cifra">{num(insights.respuestas)}</span> respuestas completas · leído el{" "}
        {fechaHoraEnBogota(leidoEn)}
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 font-medium">Pregunta</th>
              <th className="py-2 pl-3 text-right font-medium">La vieron</th>
              <th className="py-2 pl-3 text-right font-medium">Se fueron aquí</th>
            </tr>
          </thead>
          <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
            {insights.preguntas.map((p, i) => (
              <tr key={p.id}>
                <td className="cifra py-2 pr-2 text-muted-foreground">{i + 1}</td>
                <td className="py-2 pr-3">{p.titulo}</td>
                <td className="cifra py-2 pl-3 text-right whitespace-nowrap">
                  {num(p.vistas)}
                  {i === 0 ? null : (
                    <span className="ml-1.5 text-xs text-muted-foreground">{porcentaje(p.vistas, vistasPrimera)}</span>
                  )}
                </td>
                <td className="cifra py-2 pl-3 text-right whitespace-nowrap">
                  {num(p.abandonos)}
                  <span className="ml-1.5 text-xs text-muted-foreground">{porcentaje(p.abandonos, p.vistas)}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * El detalle por pregunta dentro de "¿Dónde se va la gente del formulario?" (420): el Insights de Typeform de cada
 * fuente, sin tarjeta propia. Es el histórico acumulado: no sigue el periodo, y lo dice.
 */
export function DetallePorPregunta({ embudos }: { embudos: EmbudoPorPreguntaDeFuente[] }) {
  if (embudos.length === 0) return null;
  return (
    <section className="space-y-3 text-sm" aria-labelledby="embudo-por-pregunta">
      <div className="space-y-1">
        <h3 id="embudo-por-pregunta" className="text-sm font-medium">Por pregunta</h3>
        <p className="text-xs text-muted-foreground">
          Del Insights de Typeform: histórico acumulado del formulario, sin canal. No sigue el periodo, porque Typeform no lo
          deja acotar por fechas. La vieron: % sobre quienes vieron la primera pregunta. Se fueron aquí: % sobre quienes la vieron.
        </p>
      </div>
      {embudos.map((e) => (
        <Fuente key={e.fuenteId} embudo={e} conNombre={embudos.length > 1} />
      ))}
    </section>
  );
}

/** La pregunta donde se va una mayor parte de quienes la vieron, entre las fuentes leídas. */
export function preguntaQueMasPierde(embudos: readonly EmbudoPorPreguntaDeFuente[]): { titulo: string; tasa: number } | null {
  let peor: { titulo: string; tasa: number } | null = null;
  for (const e of embudos) {
    if (e.estado !== "ok") continue;
    for (const p of e.insights.preguntas) {
      if (p.vistas <= 0) continue;
      const tasa = p.abandonos / p.vistas;
      if (!peor || tasa > peor.tasa) peor = { titulo: p.titulo, tasa };
    }
  }
  return peor;
}
