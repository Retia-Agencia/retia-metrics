import type { JSX } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { cop, num, pct } from "@/lib/format";
import type { PeriodoResuelto } from "@/lib/periodo";
import { trazaPorAnuncio } from "@/lib/queries/traza-por-anuncio";

export async function TrazaDePauta(p: {
  programId: string;
  slug: string;
  rango: { desde: string; hasta: string };
  periodo: PeriodoResuelto;
  origen: string;
}): Promise<JSX.Element> {
  const traza = await trazaPorAnuncio(db, { programId: p.programId, rango: p.rango });
  const porcentaje = traza.registros.porcentajeSinUtm;

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>Traza de pauta</CardTitle>
        <p className="text-sm text-muted-foreground">
          <span className="cifra">{num(traza.pagosSinId)}</span> de <span className="cifra">{num(traza.pagosTotales)}</span> envíos pagos sin id
          {" · "}Registros sin UTM: <span className="cifra">{num(traza.registros.sinUtm)}</span> ({porcentaje === null ? "—" : pct(porcentaje)})
        </p>
      </CardHeader>
      <CardContent>
        {traza.anuncios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todos los envíos pagos traen su anuncio.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[40rem] text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Anuncio</th>
                  <th className="py-2 pr-3 font-medium">Campaña</th>
                  <th className="py-2 pr-3 text-right font-medium">Inversión</th>
                  <th className="py-2 text-right font-medium">Envíos sin id</th>
                </tr>
              </thead>
              <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
                {traza.anuncios.map((fila) => (
                  <tr key={fila.idMeta}>
                    <td className="py-2 pr-3">{fila.nombre}</td>
                    <td className="py-2 pr-3">{fila.campana}</td>
                    <td className="cifra py-2 pr-3 text-right">{cop(fila.gastoCop)}</td>
                    <td className="cifra py-2 text-right">{num(fila.enviosPagosSinId)}</td>
                  </tr>
                ))}
                <tr className="font-medium">
                  <td className="py-2" colSpan={3}>Sin anuncio identificable</td>
                  <td className="cifra py-2 text-right">{num(traza.sinAnuncioIdentificable)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
