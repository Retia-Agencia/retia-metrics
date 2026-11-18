import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monto, pct } from "@/lib/format";
import type { CajaPorMoneda } from "@/lib/queries/dashboard";

/** Una tasa sin denominador se dice con raya, nunca como cero. */
export function tasa(valor: number | null): string {
  return valor === null ? "—" : pct(valor);
}

export function Tarjeta({
  titulo,
  valor,
  nota,
}: {
  titulo: string;
  valor: ReactNode;
  nota?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium tracking-normal text-muted-foreground">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="cifra break-words text-2xl font-semibold">{valor}</div>
        {nota ? <div className="mt-1 text-xs text-muted-foreground">{nota}</div> : null}
      </CardContent>
    </Card>
  );
}

/** La caja lleva su moneda al lado, una línea por moneda. Nunca se suma. */
export function Caja({ caja }: { caja: CajaPorMoneda[] }) {
  return (
    <>
      {caja.map((fila) => (
        <span className="block" key={fila.moneda}>
          {monto(fila.total, fila.moneda)}
        </span>
      ))}
    </>
  );
}

export function Tabla({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm [&_td:not(:first-child)]:cifra">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {cabeceras.map((cabecera, indice) => (
              <th
                key={cabecera}
                className={indice === 0 ? "py-2 font-medium" : "py-2 text-right font-medium"}
              >
                {cabecera}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
          {children}
        </tbody>
      </table>
    </div>
  );
}
