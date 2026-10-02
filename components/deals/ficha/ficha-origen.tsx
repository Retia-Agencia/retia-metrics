import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fechaHoraEnBogota } from "@/lib/format";
import type { FichaDeDeal } from "@/lib/queries/ficha-deal";
import { Dato } from "./campos";

export function FichaOrigen({ ficha }: { ficha: FichaDeDeal }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Origen</CardTitle>
      </CardHeader>
      <CardContent>
        {ficha.origen ? (
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            {([
              ["UTM Source", ficha.origen.utm.source],
              ["UTM Medium", ficha.origen.utm.medium],
              ["UTM Campaign", ficha.origen.utm.campaign],
              ["UTM Content", ficha.origen.utm.content],
              ["UTM Term", ficha.origen.utm.term],
              ["UTM ID", ficha.origen.utm.id],
            ] as const).map(([etiqueta, valor]) => (
              <Dato key={etiqueta} etiqueta={etiqueta}>
                {valor ? <span title={valor}>{valor}</span> : null}
              </Dato>
            ))}
            <Dato etiqueta="Fecha del envío">{fechaHoraEnBogota(ficha.origen.fecha)}</Dato>
            <Dato etiqueta="Estado de llegada">{ficha.origen.calificacion}</Dato>
          </dl>
        ) : (
          <p className="text-sm text-muted-foreground">Este deal no tiene envío de origen.</p>
        )}
        {/* Fuera del condicional: el origen declarado (121) importa sobre todo cuando no hay UTM. */}
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3">
          <Dato etiqueta="Origen declarado">{ficha.areaDeclarada?.nombre ?? null}</Dato>
        </dl>
      </CardContent>
    </Card>
  );
}
