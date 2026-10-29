import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct, usd } from "@/lib/format";
import type { NivelPauta, PasoPauta, RenglonRoas, VistaRoasDePauta } from "@/lib/queries/roas-de-pauta";

type Enlace = (nivel: NivelPauta, id: string | undefined, paso: PasoPauta) => string;
const claseEnlace = "rounded-lg text-marca-texto underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Cifra({ n, href }: { n: number; href: string }) {
  return n === 0 ? <>{num(n)}</> : <Link href={href} className={claseEnlace}>{num(n)}</Link>;
}

function partes(items: Array<[number, string]>) {
  return items.filter(([n]) => n > 0).map(([n, texto], i) => <span key={texto}>{i > 0 ? " · " : ""}{num(n)} {texto}</span>);
}

function CeldaVentas({ fila, enlace }: { fila: RenglonRoas; enlace: Enlace }) {
  if (fila.ventas === 0) return <span className="text-muted-foreground">0 ventas</span>;
  return <span className="block"><span className="block font-medium">
    <Link href={enlace(fila.nivel, fila.id ?? undefined, "venta")} className={claseEnlace}>
      {num(fila.ventas)} {fila.ventas === 1 ? "venta" : "ventas"}
    </Link></span>
    <span className="block text-xs text-muted-foreground">Cuándo: {partes([
      [fila.ventasEnLlamada, "en llamada"], [fila.ventasDespues, "después"], [fila.ventasSinLlamada, "sin llamada"],
    ])}</span>
    <span className="block text-xs text-muted-foreground">Pago: {partes([
      [fila.ventasCompletas, fila.ventasCompletas === 1 ? "completa" : "completas"],
      [fila.ventasParciales, fila.ventasParciales === 1 ? "parcial" : "parciales"],
    ])}</span></span>;
}

function Madurez({ fila, sinHistorial }: { fila: RenglonRoas; sinHistorial: boolean }) {
  if (fila.desdeDias === null || fila.hastaDias === null) return <span className="text-xs text-muted-foreground">Sin registros</span>;
  return <span className="block text-xs text-muted-foreground">Registros de hace {num(fila.hastaDias)} a {num(fila.desdeDias)} días{" "}
    {sinHistorial ? <span className="block">sin historial para estimar</span> : fila.madurando ? <Badge variant="alerta">Aún madurando</Badge> : null}</span>;
}

function Fila({ fila, enlace, sinHistorial, nombre, sangria = "" }: {
  fila: RenglonRoas; enlace: Enlace; sinHistorial: boolean; nombre?: ReactNode; sangria?: string;
}) {
  const resueltas = fila.shows + fila.noShows;
  return <tr>
    <td className={`py-2 pr-3 ${sangria}`}>{nombre ?? fila.nombre}</td>
    <td className="cifra py-2 pl-3 text-right"><Cifra n={fila.registros} href={enlace(fila.nivel, fila.id ?? undefined, "registro")} /></td>
    <td className="cifra py-2 pl-3 text-right"><Cifra n={fila.agendas} href={enlace(fila.nivel, fila.id ?? undefined, "agenda")} /></td>
    <td className="cifra py-2 pl-3 text-right"><Cifra n={fila.shows} href={enlace(fila.nivel, fila.id ?? undefined, "show")} /></td>
    <td className="cifra py-2 pl-3 text-right"><Cifra n={fila.noShows} href={enlace(fila.nivel, fila.id ?? undefined, "no_show")} /></td>
    <td className="cifra py-2 pl-3 text-right">{resueltas === 0 ? "—" : pct(fila.noShows / resueltas)}</td>
    <td className="cifra py-2 pl-3 text-right"><CeldaVentas fila={fila} enlace={enlace} /></td>
    <td className="cifra py-2 pl-3 text-right">{usd(fila.contratadoUsd)}{fila.sinValorVendido > 0 ? <span className="block text-xs text-muted-foreground">{num(fila.sinValorVendido)} sin valor vendido</span> : null}</td>
    <td className="cifra py-2 pl-3 text-right">{usd(fila.gastoUsd)}</td>
    <td className="cifra py-2 pl-3 text-right">{fila.gastoUsd === 0 ? "sin pauta" : num(fila.contratadoUsd / fila.gastoUsd, 2)}<Madurez fila={fila} sinHistorial={sinHistorial} /></td>
  </tr>;
}

export function PautaRoas({ vista, enlace, hrefCsv, campanaAbierta, hrefCampana }: {
  vista: VistaRoasDePauta;
  enlace: Enlace;
  hrefCsv: string;
  campanaAbierta?: string;
  hrefCampana: (id: string) => string;
}) {
  const conjuntos = (campana: string) => vista.conjuntos.filter((f) => f.padreId === campana);
  const anuncios = (conjunto: string) => vista.anuncios.filter((f) => f.padreId === conjunto);
  return <Card aria-labelledby="roas-pauta"><CardHeader><div className="flex flex-wrap items-center justify-between gap-2">
    <div><CardTitle id="roas-pauta">ROAS por anuncio y campaña</CardTitle><p className="text-sm text-muted-foreground">Anclado a la fecha de registro.</p></div>
    <Link href={hrefCsv} className={claseEnlace}>Descargar citas (CSV)</Link>
  </div></CardHeader><CardContent className="space-y-3 overflow-x-auto">
    {vista.trmEtiqueta ? <p className="text-xs text-muted-foreground">{vista.trmEtiqueta}</p> : null}
    {vista.diasSinTrm.map((dia) => <p key={dia} className="text-xs text-muted-foreground">Sin TRM del {dia}</p>)}
    <table className="w-full min-w-max text-sm"><thead><tr className="border-b text-left text-xs text-muted-foreground">
      <th className="py-2 font-medium">Campaña › conjunto › anuncio</th>
      {["Registros", "Agendas", "Shows", "No shows", "% no show", "Ventas", "Contratado USD", "Gasto USD", "ROAS"].map((titulo) =>
        <th key={titulo} className="py-2 pl-3 text-right font-medium">{titulo}</th>)}
    </tr></thead><tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
      <Fila fila={vista.total} enlace={enlace} sinHistorial={vista.sinHistorial} />
      {vista.campanas.flatMap((campana) => {
        const abierta = campana.id === campanaAbierta;
        const filas: ReactNode[] = [<Fila key={campana.id} fila={campana} enlace={enlace} sinHistorial={vista.sinHistorial}
          nombre={<Link href={hrefCampana(campana.id!)} className={claseEnlace}>{abierta ? "▾" : "▸"} {campana.nombre}</Link>} />];
        if (abierta) for (const conjunto of conjuntos(campana.id!)) {
          filas.push(<Fila key={conjunto.id} fila={conjunto} enlace={enlace} sinHistorial={vista.sinHistorial} sangria="pl-6" />);
          for (const anuncio of anuncios(conjunto.id!)) filas.push(
            <Fila key={anuncio.id} fila={anuncio} enlace={enlace} sinHistorial={vista.sinHistorial} sangria="pl-12" />,
          );
        }
        return filas;
      })}
      {(vista.sinAnuncio.registros > 0 || vista.sinAnuncio.agendas > 0 || vista.sinAnuncio.ventas > 0) ? <>
        <Fila fila={vista.sinAnuncio} enlace={enlace} sinHistorial={vista.sinHistorial} />
        {vista.sinAnuncio.ventas > 0 ? <tr><td colSpan={10} className="py-2 text-xs text-muted-foreground">{num(vista.sinAnuncio.ventas)} de {num(vista.total.ventas)} ventas sin anuncio</td></tr> : null}
      </> : null}
    </tbody></table>
  </CardContent></Card>;
}
