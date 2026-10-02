import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { FichaDeDeal } from "@/lib/queries/ficha-deal";
import { Dato, Vacio } from "./campos";

export function FichaPerfil({ perfil }: { perfil: FichaDeDeal["perfil"] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Perfil</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-4">
          <Dato etiqueta="Lead quality">{perfil.leadQuality ? <Badge variant="neutro">{perfil.leadQuality}</Badge> : null}</Dato>
          <Dato etiqueta="Lead value">{perfil.leadValue ? <Badge variant="neutro">{perfil.leadValue}</Badge> : null}</Dato>
        </dl>
        {perfil.respuestas.length === 0 ? (
          <Vacio>Este envío no tiene otras respuestas para mostrar.</Vacio>
        ) : (
          <dl className="divide-y">
            {perfil.respuestas.map((r, indice) => (
              <div key={`${r.pregunta}-${indice}`} className="min-w-0 py-3 first:pt-0 last:pb-0">
                <dt className="text-xs text-muted-foreground">{r.pregunta}</dt>
                <dd className="break-words text-sm" title={r.respuesta}>{r.respuesta}</dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
