import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * La pestaña Origen del Hub (ADR 0086 punto 2): de dónde vino cada lead y cómo cuenta cada
 * UTM. La arma el 248; mientras tanto lo dice y manda a Pauta, donde sigue el origen por canal.
 */
export function OrigenPendiente({ hrefPauta }: { hrefPauta: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Origen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <p>Aquí vas a ver de dónde vino cada lead y cómo cuenta cada UTM. Todavía se está construyendo.</p>
        <p>
          Mientras tanto, el origen por canal está en{" "}
          <Link className="underline underline-offset-4" href={hrefPauta}>Pauta</Link>.
        </p>
      </CardContent>
    </Card>
  );
}
