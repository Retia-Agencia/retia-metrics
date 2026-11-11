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
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { BadgeDeEstado, ExplicacionDeCifra, PUNTO } from "@/components/como-se-calcula";
import { BarraDeAvance } from "@/components/hub/barra-de-avance";
import { CambioDeCifra } from "@/components/variacion";
import { cn } from "@/lib/utils";
import type { CifraDeMetrica } from "@/lib/metricas/cifra";
import { monto, num, pct } from "@/lib/format";
import { nombreCorto } from "@/lib/vocabulario-metricas";
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
  return (
    <Dialog>
      <DialogTrigger
        render={<Button variant="link" className="cifra h-auto p-0 text-inherit text-[length:inherit]" />}
        aria-label={`Ver resumen de ${titulo}`}
      >
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <ResumenDeCifra titulo={titulo} detalle={detalle} />
      </DialogContent>
    </Dialog>
  );
}

/**
 * La Cifra (ticket 419, diseño de la Cifra §1): una sola pieza en todo el Hub. A la vista, solo lo necesario para leerla
 * en un segundo; toda la tarjeta es el botón que abre la explicación en el panel lateral. Tres tamaños de la misma
 * pieza: `tarjeta` (con barra si la cifra trae avance) y `celda` de tabla. No calcula nada: pinta `CifraDeMetrica`.
 */
export function Cifra({ cifra, tamano = "tarjeta", className }: {
  cifra: CifraDeMetrica;
  tamano?: "tarjeta" | "celda";
  className?: string;
}) {
  const disparador = tamano === "celda" ? <CeldaDeCifra cifra={cifra} /> : <TarjetaDeCifra cifra={cifra} />;
  return (
    <Sheet>
      <SheetTrigger
        aria-label={cifra.ariaLabel}
        data-abre-explicacion=""
        className={cn(
          tamano === "celda"
            ? "inline-flex cursor-pointer flex-col items-end gap-px rounded-md px-1 py-0.5 text-right transition-colors duration-150 outline-none hover:bg-marca-suave focus-visible:outline-2 focus-visible:outline-marca"
            : "group flex min-w-0 cursor-pointer flex-col gap-2 rounded-xl border border-transparent bg-card p-3.5 text-left shadow-tarjeta transition-colors duration-150 outline-none hover:border-marca focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-marca",
          className,
        )}
      >
        {disparador}
      </SheetTrigger>
      <SheetContent>
        <ExplicacionDeCifra cifra={cifra} />
      </SheetContent>
    </Sheet>
  );
}

function TarjetaDeCifra({ cifra }: { cifra: CifraDeMetrica }) {
  return (
    <>
      <span className="flex items-start justify-between gap-2 text-[13px]">
        <span>
          <span className="font-medium">{cifra.rotulo}</span>{" "}
          <span className="text-muted-foreground">· {cifra.textoDeUniverso}</span>
        </span>
        <BadgeDeEstado estado={cifra.estado} />
      </span>
      <span className={cn("cifra text-[26px] leading-[1.1] font-semibold", cifra.vacio && "text-muted-foreground")}>
        {cifra.textoDelValor}
        {cifra.deMeta ? <span className="ml-1.5 font-sans text-[13px] font-medium text-muted-foreground">{cifra.deMeta}</span> : null}
      </span>
      {cifra.barra ? (
        <>
          <BarraDeAvance
            lleno={cifra.barra.lleno}
            atraso={cifra.barra.atraso}
            marca={cifra.barra.marca}
            rotuloDeMarca={cifra.barra.rotuloDeMarca}
            tono={cifra.estado?.tono}
            etiqueta={`Llevamos ${cifra.textoDelValor} ${cifra.deMeta ?? ""}`.trim()}
          />
          <span className="text-xs text-muted-foreground">
            {cifra.barra.lectura.antes}
            <b className="cifra font-medium text-foreground">{cifra.barra.lectura.cifra}</b>
            {cifra.barra.lectura.despues}
          </span>
        </>
      ) : null}
      {cifra.linea ? (
        <span className="text-xs text-muted-foreground">
          {cifra.linea.antes}
          {cifra.linea.cifra ? <b className="cifra font-medium text-foreground">{cifra.linea.cifra}</b> : null}
          {cifra.linea.despues}
        </span>
      ) : null}
      {cifra.comparacion ? <CambioDeCifra comparacion={cifra.comparacion} /> : null}
      {cifra.etiquetas.length > 0 ? (
        <span className="flex flex-wrap items-center gap-2">
          {cifra.etiquetas.map((etiqueta) => <Badge key={etiqueta} variant="neutro" className="rounded-lg">{etiqueta}</Badge>)}
        </span>
      ) : null}
      <span className="text-xs text-marca-texto opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
        Cómo se calcula →
      </span>
    </>
  );
}

function CeldaDeCifra({ cifra }: { cifra: CifraDeMetrica }) {
  return (
    <>
      <span className={cn("cifra inline-flex items-center gap-1.5", cifra.vacio && "text-muted-foreground")}>
        {cifra.estado ? <span aria-label={cifra.estado.rotulo} className={`size-2 rounded-full ${PUNTO[cifra.estado.tono]}`} /> : null}
        {cifra.textoDelValor}
      </span>
      {cifra.comparacion ? <CambioDeCifra comparacion={cifra.comparacion} enCelda /> : null}
    </>
  );
}

/** Contenido compartido por las cifras y los puntos de las gráficas. */
export function ResumenDeCifra({ titulo, detalle, descripcionCantidad }: {
  titulo: string;
  detalle: DetalleDeCifra;
  /** Texto después de la cantidad; las cifras normales conservan el wording histórico. */
  descripcionCantidad?: string;
}) {
  const { resumen, desgloses, href } = detalle;
  return <>
    <DialogTitle>{titulo}</DialogTitle>
        <DialogDescription>
          <span className="cifra">{num(resumen.subtotal.cantidad)}</span>{" "}
          {descripcionCantidad ?? (detalle.fotoDeHoy ? "registros a hoy; el periodo no los acota." : "registros del periodo elegido.")}
        </DialogDescription>
        {resumen.dinero ? (
          // Lista de ventas (369): las tres cifras de las MISMAS ventas, en vez de una sola suma.
          <dl className="grid grid-cols-3 gap-2 text-sm">
            {([["vendido", resumen.dinero.vendido], ["recaudado", resumen.dinero.recaudado], ["por_cobrar", resumen.dinero.porCobrar]] as const).map(([clave, valor]) => (
              <div key={clave}>
                <dt className="text-xs text-muted-foreground">{nombreCorto(clave)}</dt>
                <dd className="cifra">{monto(valor, "USD")}</dd>
              </div>
            ))}
          </dl>
        ) : resumen.subtotal.caja.map((c) => (
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
  </>;
}

/** Una tabla corta del resumen. Cada línea lleva su cantidad y su parte del total. */
function Desglose({ titulo, lineas, total }: { titulo: string; lineas: LineaDeDesglose[]; total: number }) {
  // Solo la caja trae montos: sin ellos la columna sobra y le quita ancho a la etiqueta.
  const conMonto = lineas.some((linea) => linea.caja.length > 0);
  // Sin líneas no hay desglose que mostrar (Mi espacio no expone a los demás closers).
  if (lineas.length === 0) return null;

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
