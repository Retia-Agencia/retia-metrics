"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num } from "@/lib/format";
import type { AnuncioConPlantilla, PlantillasDeCuenta } from "@/lib/queries/origen";

type ClaveDePlantilla = "vieja" | "pauta" | "otra" | "sinId";

const COLUMNAS: { clave: ClaveDePlantilla; titulo: string }[] = [
  { clave: "vieja", titulo: "Vieja" },
  { clave: "pauta", titulo: "Pauta" },
  { clave: "otra", titulo: "Otra" },
  { clave: "sinId", titulo: "Sin id de anuncio" },
];
const ETIQUETA: Record<AnuncioConPlantilla["tipo"], string> = { vieja: "Vieja", pauta: "Pauta", otra: "Otra", sin_id: "Sin id de anuncio" };
const VARIANTE: Record<AnuncioConPlantilla["tipo"], "exito" | "neutro" | "alerta"> = { vieja: "neutro", pauta: "exito", otra: "alerta", sin_id: "alerta" };

function tituloDeTags(fila: PlantillasDeCuenta, clave: ClaveDePlantilla) {
  const tags = fila.tagsPorTipo[clave];
  return tags.length > 0 ? tags.join("\n\n") : clave === "sinId" ? "Sin parámetros de URL" : "";
}

export function TablaDePlantillas({ plantillas, descripciones }: {
  plantillas: PlantillasDeCuenta[];
  descripciones: Record<ClaveDePlantilla, string>;
}) {
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(new Set());
  const alternar = (cuenta: string) => setAbiertas((actuales) => {
    const siguientes = new Set(actuales);
    if (siguientes.has(cuenta)) siguientes.delete(cuenta); else siguientes.add(cuenta);
    return siguientes;
  });

  return <Card><CardHeader className="space-y-2">
    <CardTitle className="text-base">Plantillas en uso por cuenta</CardTitle>
    <p className="text-xs text-muted-foreground">Cuenta anuncios activos en Meta, no registros.</p>
    <div className="space-y-1 text-xs text-muted-foreground">{COLUMNAS.map(({ clave, titulo }) => <p key={clave}><span className="font-medium text-foreground">{titulo}:</span> {descripciones[clave]}</p>)}</div>
  </CardHeader><CardContent>
    {plantillas.length === 0 ? <p className="text-sm text-muted-foreground">Sin anuncios activos guardados.</p> : <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] table-fixed text-sm">
        <colgroup><col /><col className="w-24" /><col className="w-24" /><col className="w-24" /><col className="w-36" /></colgroup>
        <thead><tr className="border-b text-xs text-muted-foreground"><th className="py-2 pr-3 text-left font-medium">Cuenta</th>{COLUMNAS.map(({ clave, titulo }) => <th key={clave} className="py-2 text-right font-medium" title={descripciones[clave]}>{titulo}</th>)}</tr></thead>
        <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">{plantillas.flatMap((fila) => {
          const abierta = abiertas.has(fila.cuenta);
          const filas = [<tr key={fila.cuenta}><td className="py-2 pr-3"><Button type="button" variant="ghost" size="sm" aria-expanded={abierta} onClick={() => alternar(fila.cuenta)}><span aria-hidden>{abierta ? "▾" : "▸"}</span> {fila.cuenta}</Button></td>{COLUMNAS.map(({ clave }) => <td key={clave} className="cifra text-right" title={tituloDeTags(fila, clave)}>{num(fila[clave])}</td>)}</tr>];
          if (abierta) filas.push(<tr key={`${fila.cuenta}:anuncios`}><td colSpan={5} className="bg-muted/20 px-4 py-3">
            {/* ponytail: Sin paginación porque hoy son decenas; si una cuenta supera ~200 anuncios activos, paginar en el servidor. */}
            <table className="w-full table-fixed text-xs"><colgroup><col className="w-2/5" /><col className="w-2/5" /><col className="w-1/5" /></colgroup><thead><tr className="text-muted-foreground"><th className="pb-2 text-left font-medium">Anuncio</th><th className="pb-2 text-left font-medium">Campaña › Conjunto</th><th className="pb-2 text-left font-medium">Plantilla</th></tr></thead><tbody className="divide-y">{fila.anuncios.map((anuncio) => <tr key={anuncio.idMeta}><td className="py-2 pr-3 align-top"><p>{anuncio.nombre}</p><p className="break-all font-mono text-xs text-muted-foreground">{anuncio.urlTags ?? "Sin parámetros de URL"}</p></td><td className="py-2 pr-3 align-top">{anuncio.campana ?? "Sin campaña"} › {anuncio.conjunto ?? "Sin conjunto"}</td><td className="py-2 align-top"><Badge variant={VARIANTE[anuncio.tipo]}>{ETIQUETA[anuncio.tipo]}</Badge></td></tr>)}</tbody></table>
          </td></tr>);
          return filas;
        })}</tbody>
      </table>
    </div>}
  </CardContent></Card>;
}
