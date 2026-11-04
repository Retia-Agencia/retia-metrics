import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  FORMAS,
  PASOS,
  ROTULOS,
  UNIDADES,
  hrefConConfigDeGrafica,
  type ConfigDeGrafica,
} from "@/lib/series-pasos";

type Grupo = "unidad" | "paso" | "forma";

const OPCIONES: Record<Grupo, readonly string[]> = { unidad: UNIDADES, paso: PASOS, forma: FORMAS };
const NOMBRE_DEL_GRUPO: Record<Grupo, string> = { unidad: "Unidad", paso: "Paso", forma: "Forma" };

/**
 * Los interruptores de una gráfica (ticket 370), encima de ella y con el valor elegido a la vista.
 * Son enlaces: el estado vive en la URL (`?g_<clave>=plata,semana,acum`), así que un enlace guardado y el
 * PDF del reporte muestran lo mismo. `sinUnidad` esconde la unidad en gráficas que no tienen plata (DH-3).
 */
export function InterruptoresDeGrafica({
  origen,
  clave,
  config,
  sinUnidad = false,
}: {
  origen: string;
  clave: string;
  config: ConfigDeGrafica;
  sinUnidad?: boolean;
}) {
  const grupos = (["unidad", "paso", "forma"] as const).filter((grupo) => !(sinUnidad && grupo === "unidad"));
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2" data-testid={`interruptores-${clave}`}>
      {grupos.map((grupo) => (
        <div key={grupo} role="group" aria-label={NOMBRE_DEL_GRUPO[grupo]} className="flex items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">{NOMBRE_DEL_GRUPO[grupo]}</span>
          {OPCIONES[grupo].map((valor) => {
            const activa = config[grupo] === valor;
            return (
              <Button
                key={valor}
                size="sm"
                variant={activa ? "default" : "outline"}
                nativeButton={false}
                aria-current={activa ? "true" : undefined}
                render={<Link scroll={false} href={hrefConConfigDeGrafica(origen, clave, { ...config, [grupo]: valor }, { sinUnidad })} />}
              >
                {(ROTULOS[grupo] as Record<string, string>)[valor]}
              </Button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
