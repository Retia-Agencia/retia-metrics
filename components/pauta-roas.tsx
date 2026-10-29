import Link from "next/link";
import type { ReactNode } from "react";
import { ComoSeCalcula } from "@/components/como-se-calcula";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct, usd } from "@/lib/format";
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

function Fila({ fila, enlace, nombre, sangria = "" }: {
  fila: RenglonRoas; enlace: Enlace; nombre?: ReactNode; sangria?: string;
}) {
  const resueltas = fila.shows + fila.noShows;
  return <tr>
    <td className={`break-words py-2 pr-2 align-top ${sangria}`}>{nombre ?? fila.nombre}</td>
    <td className="cifra py-2 pl-1 text-right align-top"><Cifra n={fila.registros} href={enlace(fila.nivel, fila.id ?? undefined, "registro")} /></td>
    <td className="cifra py-2 pl-1 text-right align-top"><Cifra n={fila.agendas} href={enlace(fila.nivel, fila.id ?? undefined, "agenda")} /></td>
    <td className="cifra py-2 pl-1 text-right align-top"><Cifra n={fila.shows} href={enlace(fila.nivel, fila.id ?? undefined, "show")} /></td>
    <td className="cifra py-2 pl-1 text-right align-top"><Cifra n={fila.noShows} href={enlace(fila.nivel, fila.id ?? undefined, "no_show")} /></td>
    <td className="cifra py-2 pl-1 text-right align-top">{resueltas === 0 ? "—" : pct(fila.noShows / resueltas)}</td>
    <td className="cifra py-2 pl-3 text-right align-top"><CeldaVentas fila={fila} enlace={enlace} /></td>
    <td className="cifra py-2 pl-1 text-right align-top">{usd(fila.contratadoUsd)}</td>
    <td className="cifra py-2 pl-1 text-right align-top">{usd(fila.gastoUsd)}</td>
    <td className="cifra py-2 pl-1 text-right align-top">{fila.gastoUsd === 0 ? "sin pauta" : num(fila.contratadoUsd / fila.gastoUsd, 2)}</td>
  </tr>;
}

function InformacionRoas({ vista }: { vista: VistaRoasDePauta }) {
  const { cobertura } = vista;
  const madurez = vista.ventanaCierreDias === null
    ? "Todavía no hay 5 ventas para estimarlo."
    : vista.total.desdeDias === null || vista.total.hastaDias === null
      ? `Aquí una venta tarda en mediana ${num(vista.ventanaCierreDias)} días desde el registro (sobre ${num(vista.ventasParaMadurez)} ventas).`
      : `Los registros tienen entre ${num(vista.total.desdeDias)} y ${num(vista.total.hastaDias)} días; aquí una venta tarda en mediana ${num(vista.ventanaCierreDias)} días desde el registro (sobre ${num(vista.ventasParaMadurez)} ventas).`;
  return <ComoSeCalcula>
    <section className="space-y-1"><h3 className="font-medium">De dónde sale</h3><p className="text-muted-foreground">
      Registros pagos del periodo; sus agendas, shows y ventas cuentan aunque ocurran después. Contratado es el valor
      vendido que escribe el closer. El gasto es lo que reporta Meta por anuncio, en COP convertido a USD con la TRM de cada día.
    </p></section>
    <section className="space-y-1"><h3 className="font-medium">Fórmula</h3><p className="text-muted-foreground">ROAS = contratado ÷ gasto.</p></section>
    <section className="space-y-1"><h3 className="font-medium">Madurez</h3><p className="text-muted-foreground">{madurez}</p>
      {vista.ventanaCierreDias !== null && vista.total.desdeDias !== null && vista.total.desdeDias < vista.ventanaCierreDias
        ? <p className="text-muted-foreground">El ROAS de este periodo todavía va a subir.</p> : null}
    </section>
    <section className="space-y-1"><h3 className="font-medium">TRM usada</h3>
      <p className="text-muted-foreground">{vista.trmEtiqueta ?? "No hay una TRM aplicada en este periodo."}</p>
      {vista.diasSinTrm.length > 0 ? <p className="text-muted-foreground">Días sin TRM: {vista.diasSinTrm.map(fecha).join(", ")}.</p> : null}
    </section>
    <section className="space-y-1"><h3 className="font-medium">Cobertura de UTM</h3><ul className="space-y-1 text-muted-foreground">
      <li>Con anuncio: <span className="cifra">{num(cobertura.anuncio)}</span>. Se miden hasta el anuncio.</li>
      <li>Solo campaña o conjunto: <span className="cifra">{num(cobertura.soloCampanaOConjunto)}</span>. Se miden por campaña: el link manda el id de la campaña, o ningún id y solo su nombre. Para llegar al anuncio, el link tiene que llevar <code>utm_id={"{{ad.id}}"}</code> y la landing pasarlo al formulario.</li>
      <li>Sin campaña de Meta: <span className="cifra">{num(cobertura.sinCampana)}</span>. No traen id ni un nombre de campaña que exista en Meta: no se pueden atribuir y van en su propia fila.</li>
    </ul></section>
    {vista.total.sinValorVendido > 0 ? <section className="space-y-1"><h3 className="font-medium">Ventas sin valor vendido</h3><p className="text-muted-foreground">
      <span className="cifra">{num(vista.total.sinValorVendido)}</span>: el closer no escribió el valor vendido; cuentan como venta pero suman 0 al contratado.</p></section> : null}
    <section className="space-y-1"><h3 className="font-medium">Citas sin marcar</h3><p className="text-muted-foreground">
      <span className="cifra">{num(vista.citasSinMarcar)}</span>: el closer no marcó show o no show.
    </p></section>
  </ComoSeCalcula>;
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
  return <Card aria-labelledby="roas-pauta"><CardHeader><div className="flex flex-wrap items-start justify-between gap-2">
    <div><CardTitle id="roas-pauta">ROAS por anuncio y campaña</CardTitle><p className="text-sm text-muted-foreground">Anclado a la fecha de registro.</p></div>
    <div className="flex flex-wrap items-center gap-2"><InformacionRoas vista={vista} /><Link href={hrefCsv} className={claseEnlace}>Descargar citas (CSV)</Link></div>
  </div></CardHeader><CardContent className="space-y-3">
    <table className="w-full table-fixed text-xs"><thead><tr className="border-b text-left text-xs text-muted-foreground">
      <th className="w-[19%] py-2 font-medium">Campaña › conjunto › anuncio</th>
      {["Registros", "Agendas", "Shows", "No shows", "% no show", "Ventas", "Contratado USD", "Gasto USD", "ROAS"].map((titulo) =>
        <th key={titulo} className={`break-words py-2 pl-1 text-right font-medium${titulo === "Ventas" ? " w-[17%] pl-3" : ""}`}>{titulo}</th>)}
    </tr></thead><tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">
      <Fila fila={vista.total} enlace={enlace} />
      {vista.campanas.flatMap((campana) => {
        const abierta = campana.id === campanaAbierta;
        const filas: ReactNode[] = [<Fila key={campana.id} fila={campana} enlace={enlace}
          nombre={<Link href={hrefCampana(campana.id!)} className={`${claseEnlace} break-words`}>{abierta ? "▾" : "▸"} {campana.nombre}</Link>} />];
        if (abierta) {
          for (const conjunto of conjuntos(campana.id!)) {
            filas.push(<Fila key={conjunto.id} fila={conjunto} enlace={enlace} sangria="pl-3" />);
            for (const anuncio of anuncios(conjunto.id!)) filas.push(
              <Fila key={anuncio.id} fila={anuncio} enlace={enlace} sangria="pl-6" />,
            );
          }
          const residual = vista.anunciosSinIdentificar.find((fila) => fila.padreId === campana.id);
          if (residual) filas.push(<Fila key={`residual-${campana.id}`} fila={residual} enlace={enlace} sangria="pl-6" />);
        }
        return filas;
      })}
      {(vista.sinAnuncio.registros > 0 || vista.sinAnuncio.agendas > 0 || vista.sinAnuncio.ventas > 0) ? <>
        <Fila fila={vista.sinAnuncio} enlace={enlace} />
        {vista.sinAnuncio.ventas > 0 ? <tr><td colSpan={10} className="py-2 text-xs text-muted-foreground">{num(vista.sinAnuncio.ventas)} de {num(vista.total.ventas)} ventas sin campaña de Meta</td></tr> : null}
      </> : null}
    </tbody></table>
  </CardContent></Card>;
}
