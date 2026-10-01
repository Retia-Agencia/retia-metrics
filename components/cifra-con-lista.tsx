"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { monto, num, pct } from "@/lib/format";
import type { LineaDeDesglose } from "@/lib/queries/metricas-con-filas";
import type { DetalleDeCifra } from "@/lib/queries/vista-metrica";

interface Props {
  titulo: string;
  detalle?: DetalleDeCifra;
  children: ReactNode;
}

/**
 * Toda cifra abre su lista en dos pasos (ADR 0067 punto 5): el primer clic muestra el
 * resumen (cuántos, por closer, etapa y antigüedad), y solo el enlace pide la vista con
 * las filas, paginada en el servidor. Una cifra sin filas no se pinta clicable.
 */
export function CifraConLista({ titulo, detalle, children }: Props) {
  if (!detalle?.resumen.disponible || detalle.resumen.subtotal.cantidad === 0) {
    return <>{children}</>;
  }
  const { resumen, desgloses, href } = detalle;

  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="link" className="cifra h-auto p-0 text-inherit text-[length:inherit]" />}
        aria-label={`Ver resumen de ${titulo}`}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription>
          <span className="cifra">{num(resumen.subtotal.cantidad)}</span> registros del periodo A.
        </DialogDescription>
        {resumen.subtotal.caja.map((c) => (
          <p className="cifra text-lg" key={c.moneda}>
            {monto(c.total, c.moneda)}
          </p>
        ))}
        <Desglose titulo="Por closer" lineas={desgloses.porCloser} total={resumen.subtotal.cantidad} />
        <Desglose titulo="Por etapa" lineas={desgloses.porEtapa} total={resumen.subtotal.cantidad} />
        <Desglose
          titulo="Por antigüedad (días)"
          lineas={desgloses.porAntiguedad}
          total={resumen.subtotal.cantidad}
        />
        <p className="text-xs text-muted-foreground">
          Antigüedad desde la fecha de la fila hasta hoy en Bogotá; las fechas futuras cuentan 0 días.
        </p>
        {/* `nativeButton={false}`: se pinta como <a>; sin eso Base UI avisa en consola. */}
        <Button nativeButton={false} render={<Link href={href} />}>
          Ver la lista completa
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/** Una tabla corta del resumen. Cada línea lleva su cantidad y su parte del total. */
function Desglose({ titulo, lineas, total }: { titulo: string; lineas: LineaDeDesglose[]; total: number }) {
  // Solo la caja trae montos: sin ellos la columna sobra y le quita ancho a la etiqueta.
  const conMonto = lineas.some((linea) => linea.caja.length > 0);

  return (
    <section className="space-y-1">
      <h3 className="text-sm font-medium">{titulo}</h3>
      <table className="w-full table-fixed text-sm">
        <tbody className="divide-y">
          {lineas.map((linea) => (
            <tr key={linea.etiqueta}>
              <td className="truncate py-1.5" title={linea.etiqueta}>{linea.etiqueta}</td>
              <td className="cifra w-10 text-right">{num(linea.cantidad)}</td>
              <td className="cifra w-12 text-right text-muted-foreground">
                {pct(linea.cantidad / total, 0)}
              </td>
              {conMonto && (
                <td className="cifra w-28 text-right sm:w-36">
                  {linea.caja.map((c) => monto(c.total, c.moneda)).join(" · ")}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
