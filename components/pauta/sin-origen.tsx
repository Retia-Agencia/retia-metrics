import type { JSX } from "react";
import { Cifra } from "@/components/cifra-con-lista";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { db } from "@/lib/db";
import { armarCifra } from "@/lib/metricas/cifra";
import { explicacionDe } from "@/lib/metricas/explicacion";
import { cifrasDeSinOrigen, type ContextoDeOrigen } from "@/lib/pauta/cifras-de-origen";
import { num } from "@/lib/format";
import type { VistaOrigen } from "@/lib/queries/origen";
import { trazaPorAnuncio } from "@/lib/queries/traza-por-anuncio";

/**
 * "¿Qué llega sin origen?" (420, diseño §5.2): lo que no se puede atribuir a un anuncio, la lista para corregir los
 * enlaces. Reemplaza a la Traza de pauta y recoge lo que Origen decía del rastreo (precisión hasta el anuncio y el
 * contenido con código que no reconocemos), así ninguna de esas cifras se pierde.
 */
export async function SinOrigen({ contexto, programId, rango, vistaOrigen, hrefPiezasDesconocidas }: {
  contexto: ContextoDeOrigen;
  programId: string;
  rango: { desde: string; hasta: string };
  vistaOrigen: VistaOrigen;
  hrefPiezasDesconocidas: string;
}): Promise<JSX.Element> {
  const traza = await trazaPorAnuncio(db, { programId, rango });
  const [sinAnuncio, ventasSinAnuncio] = cifrasDeSinOrigen(contexto);
  const filtros: Array<readonly [string, string]> = [];
  if (contexto.programa) filtros.push(["Programa", contexto.programa]);
  filtros.push(["Periodo", contexto.periodo]);
  const porcentajeSinUtm = traza.registros.porcentajeSinUtm;
  const sinUtm = armarCifra({
    concepto: "registros_sin_utm", explicacion: explicacionDe("registros_sin_utm", { universo: "todas" }), valor: traza.registros.sinUtm,
    filtros, periodo: contexto.periodo,
    linea: { antes: "de ", cifra: num(traza.registros.total), despues: ` registros${porcentajeSinUtm === null ? "" : ` (${Math.round(porcentajeSinUtm * 100)} %)`}` },
  });
  return (
    <Card aria-labelledby="sin-origen" data-testid="sin-origen">
      <CardHeader className="space-y-1">
        <CardTitle id="sin-origen">¿Qué llega sin origen?</CardTitle>
        <p className="text-xs text-muted-foreground">Lo que no se puede atribuir a un anuncio. Es la lista para corregir los enlaces.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Cifra cifra={sinAnuncio} />
          <Cifra cifra={ventasSinAnuncio} />
          <Cifra cifra={sinUtm} />
        </div>
        {traza.anuncios.length === 0 && traza.sinAnuncioIdentificable === 0
          ? <p className="text-sm text-muted-foreground">{sinAnuncio.valor === 0
            ? "Todos los registros de pauta traen su anuncio."
            : "Ninguno trae una campaña o un conjunto que permita saber de qué anuncio es: hay que revisar los enlaces de pauta."}</p>
          : <section className="space-y-2" aria-label="Anuncios que llegan sin id">
            <h3 className="text-sm font-medium">Anuncios cuyos enlaces llegan sin id</h3>
            <ul className="divide-y text-sm">
              {traza.anuncios.map((fila) => (
                <li key={fila.idMeta} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 py-2">
                  <span className="min-w-0 break-words">{fila.nombre}</span>
                  <span className="min-w-0 break-words text-xs text-muted-foreground">{fila.campana}</span>
                  <span className="cifra shrink-0">{num(fila.enviosPagosSinId)} sin id</span>
                </li>
              ))}
              {traza.sinAnuncioIdentificable > 0 ? (
                <li className="flex justify-between gap-3 py-2 text-muted-foreground">
                  <span>Sin anuncio identificable</span>
                  <span className="cifra">{num(traza.sinAnuncioIdentificable)} sin id</span>
                </li>
              ) : null}
            </ul>
          </section>}
        <section className="space-y-1" aria-label="Contenido con código que no reconocemos">
          <h3 className="text-sm font-medium">Contenido con código que no reconocemos</h3>
          <p className="text-xs text-muted-foreground">Envíos que llegaron por un enlace de contenido cuyo código no es de ninguna pieza viva de este programa (descartada, de otro programa o mal copiado).</p>
          {vistaOrigen.piezasDesconocidas.envios === 0
            ? <p className="text-sm text-muted-foreground">Ninguno en este periodo.</p>
            : <>
              <p className="cifra text-lg"><a className="underline underline-offset-2" href={hrefPiezasDesconocidas}>{num(vistaOrigen.piezasDesconocidas.envios)}</a></p>
              <ul className="space-y-1 text-sm">
                {vistaOrigen.piezasDesconocidas.lista.map((fila) => <li key={fila.codigo ?? "sin-codigo"} className="flex gap-2">
                  <span className="font-mono">{fila.codigo ?? "sin código"}</span>
                  <span className="cifra text-muted-foreground">{num(fila.envios)}</span>
                </li>)}
              </ul>
            </>}
        </section>
      </CardContent>
    </Card>
  );
}
