import type { ReactNode } from "react";
import { CifraConLista } from "@/components/cifra-con-lista";
import { Variacion } from "@/components/variacion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { monto, pct } from "@/lib/format";
import type { CajaPorMoneda } from "@/lib/queries/dashboard";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import type { DetallesDelDashboard } from "@/lib/queries/vista-metrica";

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
  if (caja.length === 0) return <>—</>;
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

export function CajaConVariacion({
  vista,
  detalles,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
}) {
  const actual = new Map(vista.caja.map((fila) => [fila.moneda, fila.total]));
  const anterior = new Map(vista.anterior?.caja.map((fila) => [fila.moneda, fila.total]) ?? []);
  const monedas = [...new Set([...actual.keys(), ...anterior.keys()])].sort();

  return (
    <Tarjeta
      titulo="Caja recaudada"
      valor={
        <CifraConLista titulo="Caja recaudada" detalle={detalles?.caja}>
          <Caja caja={vista.caja} />
        </CifraConLista>
      }
      nota={
        <>
          <p>Suma de abonos por su fecha, por moneda.</p>
          {vista.anterior ? (
            monedas.map((moneda) => (
              <p key={moneda}>
                {moneda}: <Variacion
                  actual={actual.get(moneda) ?? 0}
                  anterior={anterior.get(moneda) ?? 0}
                  decimales={2}
                />
              </p>
            ))
          ) : (
            <p>—</p>
          )}
        </>
      }
    />
  );
}
