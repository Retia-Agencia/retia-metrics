import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

export function EmbudoPorPregunta({ embudos }: { embudos: EmbudoPorPreguntaDeFuente[] }) {
  if (embudos.length === 0) return null;
  return (
    <Card aria-labelledby="embudo-por-pregunta">
      <CardHeader className="space-y-1">
        <CardTitle id="embudo-por-pregunta" className="text-base">
          Embudo por pregunta
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Del Insights de Typeform: histórico acumulado del formulario, sin canal. No sigue el período ni el filtro de
          closer, porque Typeform no lo deja acotar por fechas. La vieron: % sobre quienes vieron la primera pregunta. Se
          fueron aquí: % sobre quienes la vieron.
        </p>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        {embudos.map((e) => (
          <Fuente key={e.fuenteId} embudo={e} conNombre={embudos.length > 1} />
        ))}
      </CardContent>
    </Card>
  );
}
