import type { ReactNode } from "react";
import type { ClaveDePaso, PasoVisible } from "@/lib/programas/configuracion";
import { num } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function RecorridoDeConfiguracion({
  pasos,
  editores,
  activar,
}: {
  pasos: PasoVisible[];
  editores: Record<ClaveDePaso, ReactNode>;
  activar: ReactNode;
}) {
  // Se abre primero lo que impide activar; si ya está todo lo obligatorio, el primer recomendado.
  const primerObligatorio = pasos.findIndex((paso) => paso.exigidoParaActivar && !paso.hecho);
  const primerPendiente = primerObligatorio >= 0 ? primerObligatorio : pasos.findIndex((paso) => !paso.hecho);
  const exigidos = pasos.filter((paso) => paso.exigidoParaActivar);
  const exigidosListos = exigidos.filter((paso) => paso.hecho).length;

  return (
    <Card>
      <CardHeader className="space-y-1">
        <CardTitle className="text-base">Configura el programa</CardTitle>
        <p className="text-sm text-muted-foreground">
          Completa los pasos obligatorios para activarlo. Los recomendados se pueden hacer después.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <ol className="space-y-4">
          {pasos.map((paso, indice) => (
            <li key={paso.clave} className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-3">
              <span className="cifra flex size-7 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
                {num(indice + 1)}
              </span>
              <div className="min-w-0 space-y-3">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{paso.titulo}</p>
                    <p className="text-sm text-muted-foreground">{paso.explicacion}</p>
                  </div>
                  <Badge variant={paso.hecho ? "exito" : paso.exigidoParaActivar ? "alerta" : "neutro"}>
                    {paso.hecho ? "Listo" : paso.exigidoParaActivar ? "Falta" : "Recomendado"}
                  </Badge>
                </div>
                <details open={!paso.hecho && indice === primerPendiente} className="min-w-0">
                  <summary className="w-fit cursor-pointer text-sm font-medium text-marca-texto">
                    {paso.hecho ? "Ver" : "Configurar"}
                  </summary>
                  <div className="min-w-0 pt-3">{editores[paso.clave]}</div>
                </details>
              </div>
            </li>
          ))}
        </ol>
        <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-medium">
            <span className="cifra">{num(exigidosListos)}</span> de <span className="cifra">{num(exigidos.length)}</span>{" "}
            pasos obligatorios listos
          </p>
          {activar}
        </div>
      </CardContent>
    </Card>
  );
}
