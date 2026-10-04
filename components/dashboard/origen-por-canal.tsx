import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "@/lib/format";
import type { FilaEmbudoPorCanal } from "@/lib/queries/dashboard";
import { Tabla, tasa } from "@/components/dashboard/piezas";

export function OrigenPorCanal({ filas }: { filas: FilaEmbudoPorCanal[] | null }) {
  const etiquetas = {
    sin_clasificar: "Sin clasificar",
    sin_utm: "Sin UTM",
    sin_envio_origen: "Sin envío de origen",
  } as const;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Origen del lead</CardTitle>
      </CardHeader>
      <CardContent>
        {filas === null ? (
          <p className="text-sm text-muted-foreground">
            El origen por canal es del programa entero: quita el filtro de closer para verlo.
          </p>
        ) : filas.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Sin envíos ni llamadas en este rango.
          </p>
        ) : (
          <Tabla cabeceras={["Canal", "Área", "Envíos", "Agendas", "Show", "% show", "Ventas"]}>
            {filas.map((fila) => (
              <tr key={`${fila.origen}:${fila.canalId ?? "sin-canal"}`}>
                <td className="py-2">
                  {fila.origen === "canal" ? (
                    fila.canal
                  ) : (
                    <span className="text-muted-foreground">{etiquetas[fila.origen]}</span>
                  )}
                </td>
                <td>{fila.area ?? "—"}</td>
                <td className="text-right">{num(fila.envios)}</td>
                <td className="text-right">{num(fila.agendas)}</td>
                <td className="text-right">{num(fila.shows)}</td>
                <td className="text-right">{tasa(fila.pctShow)}</td>
                <td className="text-right">{num(fila.ventas)}</td>
              </tr>
            ))}
          </Tabla>
        )}
      </CardContent>
    </Card>
  );
}
