import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Marcador de alcance: esta vista llega en la fase indicada. */
export function ProximaFase({ fase, entrega }: { fase: number; entrega: string }) {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="text-base">Llega en la Fase {fase}</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">{entrega}</CardContent>
    </Card>
  );
}
