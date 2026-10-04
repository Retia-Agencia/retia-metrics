import Link from "next/link";
import { db } from "@/lib/db";
import { canales as catalogoCanales } from "@/lib/catalogo/canales";
import { clasificacionDeEnvios } from "@/lib/atribucion/pares-sin-clasificar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enlaceConVuelta } from "@/lib/navegacion/volver";

/**
 * Sección "Canales" de Mi espacio del paid trafficker (ticket 179): lo que le toca a quien
 * maneja pauta y no administra la app ni trabaja leads. Dos cosas y un enlace:
 *  - **Pares sin clasificar**: envíos con UTM que no casan con ningún canal, agrupados por
 *    programa, con su conteo. Es un problema de CONFIGURACIÓN: se arregla con una fila en
 *    Canales (ADR 0045) y repara hacia atrás.
 *  - **Envíos por canal**: cuántos envíos completos clasifica cada canal activo (un canal
 *    en cero no casa con nada).
 *  - Enlace a `/ajustes/canales` para administrarlos.
 *
 * **Alcance:** NO se filtra por membresía. El paid trafficker no tiene membresías de
 * programa (ADR 0052), y hoy en `/ajustes/canales` ve todos los canales y todos los pares;
 * esta sección mantiene ese alcance a propósito. Los Canales son un catálogo GLOBAL (no
 * tienen `program_id`): el par es único por `canales_par_idx` para todos los programas.
 *
 * Es un componente de servidor: usa el mismo módulo que `/ajustes/canales`
 * (`clasificacionDeEnvios`, una respuesta por pregunta) y no duplica SQL.
 */
export async function TabCanales() {
  const [filas, clasificacion] = await Promise.all([
    catalogoCanales(db).listar(),
    clasificacionDeEnvios(db),
  ]);

  // Solo los canales activos tienen conteo (un inactivo no clasifica a propósito).
  const porCanal = filas
    .filter((f) => f.activo)
    .map((f) => ({
      id: f.id,
      nombre: String(f.nombre),
      utmSource: f.utmSource === null ? null : String(f.utmSource),
      utmMedium: String(f.utmMedium),
      envios: clasificacion.enviosPorCanal.get(f.id) ?? 0,
    }))
    .sort((a, b) => b.envios - a.envios || a.nombre.localeCompare(b.nombre, "es"));

  const pares = clasificacion.paresSinClasificar;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Pares sin clasificar
            {pares.length > 0 ? <Badge variant="alerta">{pares.length}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {pares.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              Todos los envíos con UTM casan con un canal. Un par sin clasificar es un
              problema de configuración, no de captación.
            </p>
          ) : (
            <ul className="divide-y">
              {pares.map((par) => (
                <li
                  key={`${par.programId}\u0000${par.source}\u0000${par.medium}`}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                >
                  <div className="min-w-0 space-y-0.5">
                    <span className="cifra block truncate">
                      {par.source || "—"} / {par.medium || "—"}
                    </span>
                    <span className="block text-xs text-muted-foreground">{par.programa}</span>
                  </div>
                  <Badge variant="neutro">
                    <span className="cifra">{par.envios}</span>
                    <span className="ml-1">envíos</span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Envíos por canal</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {porCanal.length === 0 ? (
            <p className="px-4 py-3 text-sm text-muted-foreground">
              No hay canales activos todavía. Créalos en Canales.
            </p>
          ) : (
            <ul className="divide-y">
              {porCanal.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                  <div className="min-w-0 space-y-0.5">
                    <span className="block truncate font-medium">{c.nombre}</span>
                    <span className="cifra block text-xs text-muted-foreground">
                      {c.utmSource ?? "cualquiera"} / {c.utmMedium}
                    </span>
                  </div>
                  <Badge variant="info">
                    <span className="cifra">{c.envios}</span>
                    <span className="ml-1">envíos</span>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <p className="text-sm">
        <Link
          href={enlaceConVuelta("/ajustes/canales", "/mi-espacio?tab=canales")}
          className="text-marca-texto underline-offset-2 hover:underline"
        >
          Administrar los canales
        </Link>
      </p>
    </div>
  );
}
