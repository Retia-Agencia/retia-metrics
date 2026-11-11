"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SheetDescription, SheetTitle } from "@/components/ui/sheet";
import type { CifraDeMetrica, EstadoDeCifra, FormulaEscrita } from "@/lib/metricas/cifra";

/**
 * "Cómo se calcula" de un bloque entero, con texto libre. Lo usan los bloques que todavía no pintan sus cifras con la
 * Cifra; cuando migran, cada cifra abre su propia explicación (`ExplicacionDeCifra`) y este diálogo desaparece.
 */
export function ComoSeCalcula({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="link" size="sm" className="print:hidden" />}>
        Cómo se calcula
      </DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cómo se calcula</DialogTitle>
          <DialogDescription>Fuentes, fórmulas y datos que todavía pueden completar la lectura.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 text-sm">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

/** El badge de estado con su punto (DM-1). Sin estado no se pinta: nunca un gris inventado. */
export function BadgeDeEstado({ estado }: { estado: EstadoDeCifra | null }) {
  if (!estado) return null;
  return (
    <Badge variant={estado.tono} className="rounded-lg">
      <span aria-hidden="true" className={`size-2 rounded-full ${PUNTO[estado.tono]}`} />
      {estado.rotulo}
    </Badge>
  );
}

export const PUNTO = { exito: "bg-tono-exito", alerta: "bg-tono-alerta", peligro: "bg-tono-peligro" } as const;

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">{titulo}</h3>
      {children}
    </section>
  );
}

/** La fórmula escrita como matemática: fracción apilada, Σ, "número de …", A − B o A × B (diseño §2 punto 2). */
function Formula({ formula }: { formula: FormulaEscrita }) {
  const [a, b] = formula.terminos;
  const igual = <span className="font-semibold text-muted-foreground">=</span>;
  return (
    <div role="math" aria-label={leerFormula(formula)} className="flex flex-wrap items-center gap-2.5 rounded-lg bg-tono-neutro-suave p-3.5 text-sm">
      <span className="font-semibold">{formula.nombre}</span>
      {igual}
      {formula.forma === "razon" ? (
        <>
          <span className="inline-flex flex-col items-center text-center">
            <span className="border-b-[1.5px] border-foreground px-2 pb-1">{a}</span>
            <span className="px-2 pt-1">{b}</span>
          </span>
          {formula.por1000 ? <><span className="font-semibold text-muted-foreground">×</span><span className="cifra">1.000</span></> : null}
        </>
      ) : formula.forma === "suma" ? (
        <><span className="text-lg font-semibold text-muted-foreground">Σ</span><span>{a}</span></>
      ) : formula.forma === "conteo" ? (
        <span>número de {a}</span>
      ) : (
        <><span>{a}</span><span className="font-semibold text-muted-foreground">{formula.forma === "resta" ? "−" : "×"}</span><span>{b}</span></>
      )}
    </div>
  );
}

function leerFormula(f: FormulaEscrita): string {
  const [a, b] = f.terminos;
  const cuerpo = f.forma === "razon" ? `${a} dividido por ${b}${f.por1000 ? ", por mil" : ""}`
    : f.forma === "suma" ? `suma de ${a}`
      : f.forma === "conteo" ? `número de ${a}`
        : `${a} ${f.forma === "resta" ? "menos" : "por"} ${b}`;
  return `${f.nombre} es igual a ${cuerpo}`;
}

/**
 * La explicación que abre toda cifra (diseño de la Cifra §2), en este orden: encabezado, fórmula con sus variables,
 * cómo leer la tarjeta, calculada con y la evidencia. Solo pinta: todo el texto lo escribió `armarCifra` en el servidor.
 * Vive dentro de un `SheetContent`.
 */
export function ExplicacionDeCifra({ cifra }: { cifra: CifraDeMetrica }) {
  const x = cifra.explicacion;
  return (
    <div className="flex flex-col gap-[18px]">
      <header className="flex flex-col gap-1.5">
        <SheetTitle className="pr-20">{cifra.rotulo}</SheetTitle>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`cifra text-[26px] leading-[1.1] font-semibold ${cifra.vacio ? "text-muted-foreground" : ""}`}>
            {cifra.textoDelValor}
            {cifra.deMeta ? <span className="ml-1.5 font-sans text-[13px] font-medium text-muted-foreground">{cifra.deMeta}</span> : null}
          </span>
          <BadgeDeEstado estado={cifra.estado} />
        </div>
        <SheetDescription className="text-sm text-foreground">{x.que}</SheetDescription>
      </header>

      <Seccion titulo="Fórmula">
        <Formula formula={x.formula} />
        {x.formula.conLosNumeros ? <p className="cifra text-xs text-muted-foreground">{x.formula.conLosNumeros}</p> : null}
        <dl className="grid grid-cols-[minmax(0,150px)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-[13px]">
          {x.variables.map((v) => (
            <div key={v.nombre} className="contents">
              <dt className="font-medium">{v.nombre}</dt>
              <dd className="text-muted-foreground">{v.explicacion}</dd>
            </div>
          ))}
        </dl>
        {x.aliasExcel ? <p className="text-xs text-muted-foreground">En el Excel se llama «{x.aliasExcel}».</p> : null}
      </Seccion>

      <Seccion titulo="Cómo leer la tarjeta">
        <ul className="flex flex-col">
          {x.lectura.map(([rotulo, frase]) => (
            <li key={rotulo} className="grid grid-cols-[minmax(0,120px)_minmax(0,1fr)] gap-3 border-b py-[7px] text-[13px]">
              <b className="cifra font-medium">{rotulo}</b>
              <span>{frase}</span>
            </li>
          ))}
        </ul>
      </Seccion>

      <Seccion titulo="Calculada con">
        <div className="flex flex-wrap items-center gap-2">
          {x.filtros.map(([nombre, valor]) => (
            <Badge key={nombre} variant="neutro" className="rounded-lg">{nombre}: {valor}</Badge>
          ))}
        </div>
      </Seccion>

      {x.evidencia ? (
        <Seccion titulo="La evidencia">
          {x.evidencia.nota ? <p className="text-xs text-muted-foreground">{x.evidencia.nota}</p> : null}
          <ul>
            {x.evidencia.filas.map((fila, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto] gap-2.5 border-b py-1.5 text-[13px]">
                {fila.map((celda, j) => (
                  <span key={j} className={j === fila.length - 1 ? "cifra text-right" : "truncate"}>{celda}</span>
                ))}
              </li>
            ))}
          </ul>
          {x.evidencia.boton ? <Link href={x.evidencia.href} className={buttonVariants({ className: "w-full" })}>{x.evidencia.boton}</Link> : null}
        </Seccion>
      ) : null}
    </div>
  );
}
