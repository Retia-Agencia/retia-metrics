import { db } from "@/lib/db";
import { enviosPorCanal } from "@/lib/atribucion/envios-por-canal";
import { NOMBRE_DE_AREA } from "@/lib/atribucion/canal";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Sección de canales derivados de Mi espacio del paid trafficker. */
export async function TabCanales() {
  const resumen = await enviosPorCanal(db);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Envíos por canal</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ul className="divide-y">
          {resumen.canales.map((canal) => (
            <li key={`${canal.area}:${canal.clave}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0 space-y-0.5">
                <span className="block truncate font-medium">{canal.nombre}</span>
                <Badge variant="neutro">{NOMBRE_DE_AREA[canal.area]}</Badge>
              </div>
              <Badge variant="info">
                <span className="cifra">{canal.envios}</span>
                <span className="ml-1">envíos</span>
              </Badge>
            </li>
          ))}
          <li className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
            <div className="min-w-0 space-y-0.5">
              <span className="block truncate font-medium">Sin UTM</span>
              <Badge variant="neutro">{NOMBRE_DE_AREA.sin_utm}</Badge>
            </div>
            <Badge variant="info">
              <span className="cifra">{resumen.sinUtm}</span>
              <span className="ml-1">envíos</span>
            </Badge>
          </li>
        </ul>
      </CardContent>
    </Card>
  );
}
