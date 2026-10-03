"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import type { FichaDeActividad } from "@/lib/queries/ficha-deal";
import { Vacio } from "./campos";

/**
 * La lista de actividades del deal (ticket 074, ADR 0037): contactos y notas, con canal,
 * autor y fecha. Se registran desde Transición y reemplazan las cinco columnas
 * `Registro 1-5` de la hoja.
 */
type TipoDeActividad = "contacto" | "intento" | "nota";

const ETIQUETA_DE_TIPO: Record<TipoDeActividad, string> = { contacto: "Contacto", intento: "Intento", nota: "Nota" };

export function FichaActividades({
  actividades,
  puedeRegistrar,
}: {
  actividades: FichaDeActividad[];
  /** Su dueño o quien administra; sobre un deal anulado nadie. Proyeccion: la reja es el servidor. */
  puedeRegistrar: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Actividades</CardTitle>
      </CardHeader>

      {actividades.length === 0 ? (
        <Vacio>
          Aún no hay contactos ni notas.{puedeRegistrar ? " Regístralos desde Transición." : ""}
        </Vacio>
      ) : (
        <ul className="divide-y">
          {actividades.map((a) => (
            <li key={a.id} className="space-y-1 px-4 py-3 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={a.tipo === "contacto" ? "info" : "neutro"}>{ETIQUETA_DE_TIPO[a.tipo]}</Badge>
                {a.canal ? <span className="text-xs text-muted-foreground">{a.canal}</span> : null}
                <span className="ml-auto text-xs text-muted-foreground">
                  {a.autorNombre ?? "Sistema"} · {fechaHoraEnBogota(a.fecha)}
                </span>
              </div>
              {a.nota ? <p className="whitespace-pre-wrap">{a.nota}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
