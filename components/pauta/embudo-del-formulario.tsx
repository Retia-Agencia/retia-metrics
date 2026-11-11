import { Cifra } from "@/components/cifra-con-lista";
import { DetalleDelEmbudoFormulario, PASOS } from "@/components/embudo-formulario";
import { DetallePorPregunta, preguntaQueMasPierde } from "@/components/embudo-por-pregunta";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct } from "@/lib/format";
import { armarCifra, type CifraDeMetrica } from "@/lib/metricas/cifra";
import { explicacionDePauta } from "@/lib/metricas/explicaciones-de-pauta";
import type { EmbudoDelFormulario } from "@/lib/queries/embudo-formulario";
import type { EmbudoPorPreguntaDeFuente } from "@/lib/queries/embudo-por-pregunta";

/**
 * "¿Dónde se va la gente del formulario?" (420, diseño §5.3): funde el embudo del formulario y el embudo por pregunta
 * en un bloque. Arriba, los cuatro pasos del total como Cifras, cada uno con cuántos se fueron en ese paso, y la
 * pregunta que más pierde; debajo, plegado, el detalle por canal y por pregunta (no agendaron, sin calidad).
 */
export function cifrasDelEmbudo(embudo: EmbudoDelFormulario, filtros: ReadonlyArray<readonly [string, string]>, periodo: string): CifraDeMetrica[] {
  const { total } = embudo;
  const base = explicacionDePauta("embudo");
  return PASOS.map((paso, i) => {
    const valor = total[paso.clave];
    const anterior = i === 0 ? null : total[PASOS[i - 1].clave];
    const seFueron = anterior === null ? null : Math.max(0, anterior - valor);
    const sobreElPrimero = total.dejoDatos === 0 ? null : valor / total.dejoDatos;
    return armarCifra({
      concepto: `embudo_${paso.clave}`,
      explicacion: { ...base, rotulo: paso.titulo, formula: { forma: "razon", terminos: ["Personas en este paso", "Personas que dejaron datos"] } },
      valor,
      partes: i === 0 ? undefined : [valor, total.dejoDatos],
      filtros,
      periodo,
      linea: seFueron === null
        ? { antes: "El primer paso" }
        : { antes: `${sobreElPrimero === null ? "—" : pct(sobreElPrimero)} de quienes dejaron datos · se fueron `, cifra: num(seFueron), despues: " en este paso" },
      notas: paso.deLosQue && anterior !== null && anterior > 0
        ? [["Sobre el paso anterior", `${pct(valor / anterior)} ${paso.deLosQue}.`]]
        : undefined,
    });
  });
}

export function DondeSeVaLaGente({ embudo, porPregunta, hrefNoAgendaron, programa, periodo }: {
  embudo: EmbudoDelFormulario;
  porPregunta: EmbudoPorPreguntaDeFuente[];
  hrefNoAgendaron?: string;
  programa?: string;
  /** El periodo en palabras, para "Calculada con". */
  periodo: string;
}) {
  const filtros: Array<readonly [string, string]> = [];
  if (programa) filtros.push(["Programa", programa]);
  filtros.push(["Periodo", periodo]);
  const pasos = cifrasDelEmbudo(embudo, filtros, periodo);
  const peor = preguntaQueMasPierde(porPregunta);
  return (
    <Card aria-labelledby="donde-se-va" data-testid="embudo-del-formulario">
      <CardHeader className="space-y-1">
        <CardTitle id="donde-se-va">¿Dónde se va la gente del formulario?</CardTitle>
        <p className="text-xs text-muted-foreground">Cada paso y, debajo, la pregunta que más pierde. Por registro: un parcial y su completa cuentan una vez.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {pasos.map((cifra) => <Cifra key={cifra.concepto} cifra={cifra} />)}
        </div>
        {peor ? (
          <p className="text-sm text-muted-foreground">
            La pregunta que más pierde: «{peor.titulo}», se van <span className="cifra font-semibold text-foreground">{pct(peor.tasa)}</span>.
          </p>
        ) : null}
        <details className="group space-y-4 rounded-lg border p-3">
          <summary className="cursor-pointer text-sm font-medium">Por canal y por pregunta</summary>
          <div className="space-y-6 pt-3">
            <DetalleDelEmbudoFormulario embudo={embudo} hrefNoAgendaron={hrefNoAgendaron} />
            <DetallePorPregunta embudos={porPregunta} />
          </div>
        </details>
      </CardContent>
    </Card>
  );
}
