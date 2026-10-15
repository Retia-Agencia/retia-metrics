import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { cop } from "@/lib/format";
import { semaforoDelPrograma, type MetricaSemaforo } from "@/lib/semaforo/semaforo";

const etiquetaDeColor = {
  exito: "En meta",
  alerta: "Atención",
  peligro: "En peligro",
  sin_dato: "Sin dato",
} as const;

function horaEnBogota(instante: Date): number {
  return Number(new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(instante));
}

function costo(valor: number | null): string {
  return valor === null ? "Sin costo" : cop(valor);
}

function Trayectoria({ puntos }: { puntos: MetricaSemaforo["trayectoria"] }) {
  if (puntos.length === 0) return <span>Sin fotos todavía.</span>;
  return <span>{puntos.map((punto) => `${punto.hora.slice(0, 2)}h ${costo(punto.costo)}`).join(" → ")}</span>;
}

export async function SemaforoDelPrograma({ programId }: { programId: string }) {
  const ahora = new Date();
  const metrica = await semaforoDelPrograma(db, {
    programId,
    ahora,
    tipo: horaEnBogota(ahora) >= 18 ? "cierre" : "dia",
  });
  const variante = metrica.color === "sin_dato" ? "neutro" : metrica.color;

  return (
    <Card aria-labelledby="semaforo-costo-agenda">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle id="semaforo-costo-agenda">Costo por agenda</CardTitle>
          <Badge variant={variante}>{etiquetaDeColor[metrica.color]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <p className="cifra text-2xl font-semibold">{costo(metrica.costo)}</p>
          {metrica.umbral ? (
            <p className="text-sm text-muted-foreground">(umbral {cop(metrica.umbral.meta)})</p>
          ) : null}
          <p>{metrica.agendas === 0 ? "0 agendas" : `${metrica.agendas} agendas`}</p>
        </div>

        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Ayer a esta hora</dt>
            <dd className="cifra">
              {metrica.ayerALaMismaHora ? costo(metrica.ayerALaMismaHora.costo) : "Sin referencia"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Agendas según Meta</dt>
            <dd className="cifra">{metrica.agendasMeta ?? "—"}</dd>
          </div>
          {metrica.diasSeguidosEnRojo > 0 ? (
            <div>
              <dt className="text-muted-foreground">Días hábiles seguidos en rojo</dt>
              <dd className="cifra">{metrica.diasSeguidosEnRojo}</dd>
            </div>
          ) : null}
        </dl>

        <p className="text-sm">
          <span className="text-muted-foreground">Trayectoria: </span>
          <Trayectoria puntos={metrica.trayectoria} />
        </p>

        <ul className="space-y-1 text-sm">
          {metrica.notas.map((nota) => (
            <li key={`${nota.tipo}:${nota.texto}`}>
              <Badge variant={nota.tipo === "problema" ? "peligro" : "info"}>{nota.tipo}</Badge>{" "}
              {nota.texto}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
