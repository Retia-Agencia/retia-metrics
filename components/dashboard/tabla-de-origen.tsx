"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct } from "@/lib/format";
import type { FilaOrigenCanal, FilaOrigenUtm } from "@/lib/queries/origen";

/**
 * La tabla desplegable de Hub › Origen (311). Es cliente solo por el despliegue: los enlaces
 * llegan calculados del servidor, porque `urlDeLista` vive en un módulo que carga la base.
 */
export interface EnlacesDeOrigen { registros: string; agendas: string }
export type CanalConEnlaces = Omit<FilaOrigenCanal, "pares"> & {
  enlaces: EnlacesDeOrigen;
  nombreDeArea: string;
  pares: (FilaOrigenUtm & { enlaces: EnlacesDeOrigen })[];
};

function Cifra({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="cifra underline underline-offset-4" href={href}>{children}</Link>;
}

function tasa(agendas: number, envios: number) {
  return envios === 0 ? "—" : pct(agendas / envios);
}

const MAX_PARES = 10;

export function TablaDeOrigen({ canales, totalEnvios, soloConteos }: {
  canales: CanalConEnlaces[];
  totalEnvios: number;
  soloConteos: boolean;
}) {
  const [abiertos, setAbiertos] = useState<ReadonlySet<string>>(new Set());
  const [completos, setCompletos] = useState<ReadonlySet<string>>(new Set());
  const totalAgendas = canales.reduce((total, fila) => total + fila.agendas, 0);
  const alternar = (clave: string, estado: ReadonlySet<string>, cambiar: (valor: ReadonlySet<string>) => void) => {
    const siguiente = new Set(estado);
    if (siguiente.has(clave)) siguiente.delete(clave); else siguiente.add(clave);
    cambiar(siguiente);
  };

  return <Card aria-labelledby="origen-de-los-registros">
    <CardHeader className="space-y-1">
      <CardTitle id="origen-de-los-registros" className="text-base">Origen de los registros</CardTitle>
      <p className="text-xs text-muted-foreground">
        Un registro es un envío completo; una agenda, una llamada creada en el rango y atribuida al envío que abrió su deal.
      </p>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        {/* Anchos fijos: abrir un canal no mueve las columnas. La regla va bajo su UTM, no en una columna. */}
        <table className="w-full min-w-[32rem] table-fixed text-sm">
          <colgroup><col /><col className="w-32" /><col className="w-28" /><col className="w-28" /></colgroup>
          <thead><tr className="border-b text-xs text-muted-foreground">
            <th className="py-2 pr-3 text-left font-medium">Área · canal / UTM</th>
            <th className="py-2 text-right font-medium">Registros</th>
            <th className="py-2 text-right font-medium">Agendas</th>
            <th className="py-2 text-right font-medium">% agenda</th>
          </tr></thead>
          <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
        {canales.flatMap((fila) => {
          const abierto = abiertos.has(fila.clave);
          const completo = completos.has(fila.clave);
          const pares = completo ? fila.pares : fila.pares.slice(0, MAX_PARES);
          const especial = fila.categoria !== null;
          const filas = [
            <tr key={fila.clave}>
              <td className="py-2.5 pr-3">
                <button
                  type="button"
                  className="rounded-lg text-left font-medium transition-colors duration-150 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:hover:text-foreground"
                  aria-expanded={abierto}
                  disabled={fila.pares.length === 0}
                  onClick={() => alternar(fila.clave, abiertos, setAbiertos)}
                >
                  <span aria-hidden>{abierto ? "▾" : "▸"}</span>{" "}
                  {especial ? <Badge variant={fila.categoria === "macro" ? "alerta" : "neutro"}>{fila.canal}</Badge> : `${fila.nombreDeArea} · ${fila.canal}`}
                </button>
              </td>
              <td className="text-right">
                <Cifra href={fila.enlaces.registros}>{num(fila.envios)}</Cifra>
                {especial && !soloConteos ? <span className="cifra text-muted-foreground"> · {pct(totalEnvios === 0 ? 0 : fila.envios / totalEnvios)}</span> : null}
              </td>
              <td className="text-right"><Cifra href={fila.enlaces.agendas}>{num(fila.agendas)}</Cifra></td>
              <td className="cifra text-right text-muted-foreground">{tasa(fila.agendas, fila.envios)}</td>
            </tr>,
          ];
          if (abierto) {
            filas.push(...pares.map((par) => {
              return <tr key={`${fila.clave}:${par.source ?? "∅"}:${par.medium ?? "∅"}:${par.regla}:${par.macros}`}>
                <td className="py-2 pl-6 pr-3">
                  <p className="truncate">{par.source ?? "—"} / {par.medium ?? "—"} {par.nuevo ? <Badge variant="info">Nuevo</Badge> : null}</p>
                  <p className="truncate text-xs text-muted-foreground">{par.regla}</p>
                </td>
                <td className="text-right"><Cifra href={par.enlaces.registros}>{num(par.envios)}</Cifra></td>
                <td className="text-right"><Cifra href={par.enlaces.agendas}>{num(par.agendas)}</Cifra></td>
                <td className="cifra text-right text-muted-foreground">{tasa(par.agendas, par.envios)}</td>
              </tr>;
            }));
            if (fila.pares.length > MAX_PARES) filas.push(<tr key={`${fila.clave}:todos`}>
              <td className="py-2 pl-6" colSpan={4}>
                <Button type="button" variant="link" size="sm" onClick={() => alternar(fila.clave, completos, setCompletos)}>
                  {completo ? "Ver menos" : `Ver todos (${num(fila.pares.length)})`}
                </Button>
              </td>
            </tr>);
          }
          return filas;
        })}
        <tr key="total" className="border-t font-medium">
          <td className="py-2.5">Total</td>
          <td className="cifra text-right">{num(totalEnvios)}</td>
          <td className="cifra text-right">{num(totalAgendas)}</td>
          <td className="cifra text-right text-muted-foreground">{tasa(totalAgendas, totalEnvios)}</td>
        </tr>
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>;
}
