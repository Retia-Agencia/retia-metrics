import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AlertasDelDeal } from "@/lib/queries/ficha-deal";
function Franja({ titulo, tono, filas }: {
  titulo: "Urgente" | "Alertas";
  tono: "peligro" | "alerta";
  filas: AlertasDelDeal["urgentes"];
}) {
  if (filas.length === 0) return null;
  return (
    <Card className={tono === "peligro" ? "border-l-4 border-tono-peligro" : "border-l-4 border-tono-alerta"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">{titulo} <Badge variant={tono}>{filas.length}</Badge></CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-1 text-sm">
          {filas.map((fila) => <li key={fila.motivo}>{fila.mensaje}</li>)}
        </ul>
      </CardContent>
    </Card>
  );
}

export function FichaAlertas({ alertas }: { alertas: AlertasDelDeal | null }) {
  if (!alertas) return null;
  return (
    <>
      <Franja titulo="Urgente" tono="peligro" filas={alertas.urgentes} />
      <Franja titulo="Alertas" tono="alerta" filas={alertas.alertas} />
    </>
  );
}
