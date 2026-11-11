import { Badge } from "@/components/ui/badge";
import { Cifra } from "@/components/cifra-con-lista";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { cop } from "@/lib/format";
import { ROTULO_DE_TONO } from "@/lib/metricas/cifra";
import { cifrasDelSemaforo } from "@/lib/semaforo/cifras-del-semaforo";
import { semaforoDelPrograma, type MetricaSemaforo } from "@/lib/semaforo/semaforo";

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

function horaTexto(instante: Date): string {
  return new Intl.DateTimeFormat("es-CO", { timeZone: "America/Bogota", hour: "numeric", minute: "2-digit", hour12: true })
    .format(instante).replace(/\s+/g, " ");
}

/**
 * "¿Cómo va el costo por agenda hoy?" (419 paso 3, diseño §4.2): cuatro Cifras que arma el servidor. El costo y su
 * color son los del semáforo y del reporte de WhatsApp; debajo, la trayectoria del día, la racha y las notas.
 */
export async function SemaforoDelPrograma({ programId, programa, comparar = false }: {
  programId: string;
  programa?: string;
  /** Solo si se pidió comparar en la página: "Ayer a esta hora". */
  comparar?: boolean;
}) {
  const ahora = new Date();
  const tipo = horaEnBogota(ahora) >= 18 ? "cierre" : "dia";
  const metrica = await semaforoDelPrograma(db, { programId, ahora, tipo });
  const cifras = cifrasDelSemaforo({ metrica, tipo, hora: horaTexto(ahora), comparar, programa });
  const problemas = metrica.notas.filter((nota) => nota.tipo === "problema");

  return (
    <Card aria-labelledby="semaforo-costo-agenda">
      <CardHeader>
        <CardTitle id="semaforo-costo-agenda">¿Cómo va el costo por agenda hoy?</CardTitle>
        <p className="text-xs text-muted-foreground">{cifras.subtitulo}</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Cifra cifra={cifras.costo} />
          <Cifra cifra={cifras.agendas} />
          <Cifra cifra={cifras.agendasMeta} />
          <Cifra cifra={cifras.inversion} />
        </div>
        <div className="space-y-1 text-xs text-muted-foreground">
          <p><span>Trayectoria del costo: </span><Trayectoria puntos={metrica.trayectoria} /></p>
          {metrica.racha ? (
            <p>
              Días cerrados seguidos en <Badge variant={metrica.racha.color}>{ROTULO_DE_TONO[metrica.racha.color]}</Badge>:{" "}
              <span className="cifra">{metrica.racha.dias}</span>
            </p>
          ) : null}
        </div>
        {problemas.length > 0 ? (
          <ul className="space-y-1 text-sm">
            {problemas.map((nota) => (
              <li key={nota.texto}><Badge variant="peligro">Problema</Badge> {nota.texto}</li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
