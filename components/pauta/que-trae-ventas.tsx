import Link from "next/link";
import { Cifra } from "@/components/cifra-con-lista";
import { Pestanas } from "@/components/layout/pestanas";
import { detalleDeCampana } from "@/components/pauta-roas";
import { FilaDeCampana } from "@/components/pauta-roas-campana";
import { TablaDeOrigen, type CanalConEnlaces } from "@/components/dashboard/tabla-de-origen";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { filasDeQueTraeVentas, VER_POR_ORIGEN, type ContextoDeOrigen, type FilaDeQueTraeVentas, type VerPorOrigen } from "@/lib/pauta/cifras-de-origen";
import type { NivelPauta, PasoPauta } from "@/lib/queries/roas-de-pauta";

/**
 * "¿Qué trae ventas?" (420, diseño §5.1): reemplaza a la tabla del ROAS de pauta y absorbe a Origen (vista Canal) y al
 * ranking de anuncios. Toda celda es una Cifra (`lib/pauta/cifras-de-origen.ts`); la pantalla solo pinta. Una campaña
 * abre su detalle de conjuntos y anuncios con todas las columnas de antes (envíos, realizadas, no asistió, vendido).
 */
const COLUMNAS = ["Inversión", "Agendadas", "Costo por agenda", "Ventas", "ROAS"] as const;
const CELDAS = ["inversion", "agendas", "costo", "ventas", "roas"] as const satisfies readonly (keyof FilaDeQueTraeVentas)[];

function Celdas({ fila }: { fila: FilaDeQueTraeVentas }) {
  return <>
    {CELDAS.map((clave) => <td key={clave} className="py-1.5 pl-2 text-right align-top"><Cifra cifra={fila[clave]} tamano="celda" /></td>)}
  </>;
}

function Nombre({ fila, detalle }: { fila: FilaDeQueTraeVentas; detalle: boolean }) {
  return <td className={`break-words py-2 pr-2 align-top ${fila.nivel === "total" ? "font-semibold" : ""}`}>
    {detalle ? <button type="button" className="rounded-lg text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">▸ {fila.nombre}</button> : fila.nombre}
    {fila.revisar ? <> <Badge variant="peligro">Revisar</Badge></> : null}
    {fila.nivel === "canal" ? <> <Badge variant="neutro">de pauta</Badge></> : null}
  </td>;
}

export function QueTraeVentas({ contexto, verPor, hrefDeVerPor, enlace, canalesDeOrigen, hrefCsv }: {
  contexto: ContextoDeOrigen;
  /** Las citas de pauta del periodo en CSV, con su envío de origen. */
  hrefCsv: string;
  verPor: VerPorOrigen;
  hrefDeVerPor: Record<VerPorOrigen, string>;
  /** El enlace a la lista de un renglón (para el detalle de una campaña). */
  enlace: (nivel: NivelPauta, id: string | undefined, paso: PasoPauta) => string;
  /** Vista Canal: todos los orígenes con sus enlaces, la tabla de la regla que clasificó cada uno. */
  canalesDeOrigen?: { canales: CanalConEnlaces[]; totalEnvios: number };
}) {
  const filas = filasDeQueTraeVentas(contexto, verPor);
  const primera = VER_POR_ORIGEN.find((v) => v.id === verPor)!.etiqueta;
  return <Card aria-labelledby="que-trae-ventas" data-testid="que-trae-ventas">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <CardTitle id="que-trae-ventas">¿Qué trae ventas?</CardTitle>
          <p className="text-xs text-muted-foreground">Inversión, agendas y ventas por origen. «Revisar» marca lo que gastó sin traer agendas.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
        <Link href={hrefCsv} className="text-sm text-marca-texto underline-offset-2 hover:underline">Descargar citas (CSV)</Link>
        <Pestanas
          grupos={[{ pestanas: VER_POR_ORIGEN.map((v) => ({ id: v.id, etiqueta: v.etiqueta, descripcion: `Ver por ${v.etiqueta.toLowerCase()}`, href: hrefDeVerPor[v.id] })) }]}
          activa={verPor}
          etiqueta="Ver por"
        />
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead><tr className="border-b text-xs text-muted-foreground">
            <th className="py-2 pr-2 text-left font-medium">{primera}</th>
            {COLUMNAS.map((c) => <th key={c} className="py-2 pl-2 text-right font-medium">{c}</th>)}
          </tr></thead>
          <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
            {filas.map((fila) => fila.conDetalle
              ? <FilaDeCampana key={fila.clave} id={fila.id!} nombre={fila.nombre}
                detalle={detalleDeCampana(contexto.vista, contexto.vista.campanas.find((c) => c.id === fila.id)!, enlace)}>
                <Nombre fila={fila} detalle /><Celdas fila={fila} />
              </FilaDeCampana>
              : <tr key={fila.clave} className={fila.nivel === "total" ? "bg-marca-suave" : undefined}><Nombre fila={fila} detalle={false} /><Celdas fila={fila} /></tr>)}
          </tbody>
        </table>
      </div>
      {verPor === "canal" && canalesDeOrigen
        ? <TablaDeOrigen canales={canalesDeOrigen.canales} totalEnvios={canalesDeOrigen.totalEnvios} soloConteos={false} dentroDeOtraTarjeta />
        : null}
    </CardContent>
  </Card>;
}
