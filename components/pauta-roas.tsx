import Link from "next/link";
import { noShowPorCita } from "@/lib/deals/resultados-de-llamada";
import type { ReactNode } from "react";
import { CifraDeRazon } from "@/components/cifra-de-razon";
import { ComoSeCalcula } from "@/components/como-se-calcula";
import { FilaDeCampana } from "@/components/pauta-roas-campana";
import { Tabla } from "@/components/dashboard/piezas";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, num, pct, usd } from "@/lib/format";
import type { NivelPauta, PasoPauta, RenglonRoas, VistaRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { nombreCorto, UNIVERSO_PAUTA, VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";

type Enlace = (nivel: NivelPauta, id: string | undefined, paso: PasoPauta) => string;
const claseEnlace = "rounded-lg text-marca-texto underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Las dos vistas de la misma tabla: la jerarquía de Meta, o el canal (par UTM). */
export type VerPorPauta = "campana" | "canal";

/** El ROAS se muestra con "×" (3,25×); una razón sin cobertura dice "—". */
function roas(n: number): string {
  return `${num(n, 2)}×`;
}

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

/** Las mismas columnas en las dos vistas: solo cambia la primera (nombre / sangría). */
function Celdas({ fila, enlace, nombre, sangria = "", soloConteos = false, sinGasto = false }: {
  fila: RenglonRoas; enlace: Enlace; nombre?: ReactNode; sangria?: string; soloConteos?: boolean; sinGasto?: boolean;
}) {
  const resueltas = fila.shows + fila.noShows;
  return <>
    <td className={`break-words py-2 pr-2 align-top ${sangria}`}>{nombre ?? fila.nombre}</td>
    <td className="cifra py-2 pl-1 text-right align-top"><Cifra n={fila.registros} href={enlace(fila.nivel, fila.id ?? undefined, "registro")} /></td>
    <td className="cifra py-2 pl-1 text-right align-top"><Cifra n={fila.agendas} href={enlace(fila.nivel, fila.id ?? undefined, "agenda")} /></td>
    <td className="cifra py-2 pl-1 text-right align-top"><Cifra n={fila.shows} href={enlace(fila.nivel, fila.id ?? undefined, "show")} /></td>
    <td className="cifra py-2 pl-1 text-right align-top"><Cifra n={fila.noShows} href={enlace(fila.nivel, fila.id ?? undefined, "no_show")} /></td>
    {soloConteos ? null : <td className="cifra py-2 pl-1 text-right align-top">{noShowPorCita(fila.noShows, fila.shows) === null ? "—" : <><span className="block">{pct(noShowPorCita(fila.noShows, fila.shows)!)}</span>
      <span className="block text-xs text-muted-foreground">{num(fila.noShows)} de {num(resueltas)} con resultado</span></>}</td>}
    <td className="cifra py-2 pl-3 text-right align-top"><CeldaVentas fila={fila} enlace={enlace} /></td>
    {soloConteos ? null : <>
      <td className="cifra py-2 pl-1 text-right align-top">{usd(fila.valorVendidoUsd)}</td>
      {sinGasto ? null : <>
        <td className="cifra py-2 pl-1 text-right align-top">{fila.gastoUsd === null ? "—" : usd(fila.gastoUsd)}</td>
        <td className="cifra py-2 pl-1 text-right align-top"><CifraDeRazon razon={fila.roas} formato={roas} /></td>
      </>}
    </>}
  </>;
}

function Fila(props: { fila: RenglonRoas; enlace: Enlace; nombre?: ReactNode; sangria?: string; soloConteos?: boolean; sinGasto?: boolean }) {
  return <tr><Celdas {...props} /></tr>;
}

const COLUMNAS_COMPLETAS = [VOCABULARIO_PAUTA_SEMANAL.envios, nombreCorto("agendadas"), nombreCorto("shows"), nombreCorto("no_asistio"), VOCABULARIO_PAUTA_SEMANAL.pct_no_asistio, nombreCorto("ventas"), nombreCorto("vendido"), VOCABULARIO_PAUTA_SEMANAL.gasto, VOCABULARIO_PAUTA_SEMANAL.roas];
const COLUMNAS_CONTEOS = [VOCABULARIO_PAUTA_SEMANAL.envios, nombreCorto("agendadas"), nombreCorto("shows"), nombreCorto("no_asistio"), nombreCorto("ventas")];
// Meta reporta el gasto por anuncio, no por canal: en la vista por canal no hay Gasto ni ROAS que mostrar (355).
const COLUMNAS_SIN_GASTO = COLUMNAS_COMPLETAS.filter((c) => c !== VOCABULARIO_PAUTA_SEMANAL.gasto && c !== VOCABULARIO_PAUTA_SEMANAL.roas);
const CABECERAS = (primera: string, soloConteos = false, sinGasto = false) =>
  [primera, ...(soloConteos ? COLUMNAS_CONTEOS : sinGasto ? COLUMNAS_SIN_GASTO : COLUMNAS_COMPLETAS)];

/** El detalle de una campaña (conjuntos y anuncios), que el diálogo muestra. */
function detalleDeCampana(vista: VistaRoasDePauta, campana: RenglonRoas, enlace: Enlace): ReactNode {
  const conjuntos = vista.conjuntos.filter((f) => f.padreId === campana.id);
  const anuncios = (conjunto: string) => vista.anuncios.filter((f) => f.padreId === conjunto);
  const filas: ReactNode[] = [<Fila key={campana.id} fila={campana} enlace={enlace} />];
  for (const conjunto of conjuntos) {
    filas.push(<Fila key={conjunto.id} fila={conjunto} enlace={enlace} sangria="pl-3" />);
    for (const anuncio of anuncios(conjunto.id!)) filas.push(<Fila key={anuncio.id} fila={anuncio} enlace={enlace} sangria="pl-6" />);
  }
  const residual = vista.anunciosSinIdentificar.find((fila) => fila.padreId === campana.id);
  if (residual) filas.push(<Fila key={`residual-${campana.id}`} fila={residual} enlace={enlace} sangria="pl-6" />);
  return <table className="w-full min-w-[56rem] text-xs"><thead><tr className="border-b text-left text-xs text-muted-foreground">
    {CABECERAS("Campaña › conjunto › anuncio").map((c) => <th key={c} className="break-words py-2 pl-1 text-right font-medium first:pl-0 first:text-left">{c}</th>)}
  </tr></thead>
    <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">{filas}</tbody></table>;
}

/** La reconciliación con Comercial: las ventas que el ROAS no atribuye por cohorte, nunca escondidas (N3). */
function NotaReconciliacion({ reconciliacion }: { reconciliacion: VistaRoasDePauta["reconciliacion"] }) {
  if (reconciliacion.sinEnvioDePautaODeOtroPeriodo === 0) return null;
  return <p className="text-xs text-muted-foreground">
    Ventas del periodo sin envío de pauta de origen o de registros de otro periodo:{" "}
    <span className="cifra font-medium">{num(reconciliacion.sinEnvioDePautaODeOtroPeriodo)}</span>.
    En el periodo se cerraron <span className="cifra">{num(reconciliacion.ventasDelPeriodoPorFecha)}</span> ventas;
    el ROAS atribuye <span className="cifra">{num(reconciliacion.atribuidasPorCohorteEnPeriodo)}</span> a una cohorte de registro de este periodo.
  </p>;
}

function InformacionRoas({ vista }: { vista: VistaRoasDePauta }) {
  const { cobertura } = vista;
  const mostrarCoberturaGasto = vista.coberturaGasto.primerDia === null
    || vista.coberturaGasto.primerDia > vista.rango.desde
    || vista.coberturaGasto.diasSinFila.length > 0;
  const madurez = vista.ventanaCierreDias === null
    ? "Todavía no hay 5 ventas para estimarlo."
    : vista.total.desdeDias === null || vista.total.hastaDias === null
      ? `Aquí una venta tarda en mediana ${num(vista.ventanaCierreDias)} días desde el registro (sobre ${num(vista.ventasParaMadurez)} ventas).`
      : `Los registros tienen entre ${num(vista.total.desdeDias)} y ${num(vista.total.hastaDias)} días; aquí una venta tarda en mediana ${num(vista.ventanaCierreDias)} días desde el registro (sobre ${num(vista.ventasParaMadurez)} ventas).`;
  return <ComoSeCalcula>
    <section className="space-y-1"><h3 className="font-medium">De dónde sale</h3><p className="text-muted-foreground">
      Envíos pagos del periodo; sus citas agendadas, realizadas y ventas cuentan aunque ocurran después. El valor vendido
      lo escribe el closer. El gasto es lo que reporta Meta por anuncio, en COP convertido a USD con la TRM de cada día.
    </p></section>
    <section className="space-y-1"><h3 className="font-medium">Anclas</h3><p className="text-muted-foreground">
      Registro: el día del envío. Agendada, realizada y no asistió: la cita de los envíos de esa cohorte. Venta: la cohorte
      de registro, el día del envío que trajo a la persona, aunque compre semanas después.
    </p></section>
    <section className="space-y-1"><h3 className="font-medium">Fórmula</h3><p className="text-muted-foreground">ROAS = valor vendido ÷ gasto.</p></section>
    <section className="space-y-1"><h3 className="font-medium">Madurez</h3><p className="text-muted-foreground">{madurez}</p>
      {vista.ventanaCierreDias !== null && vista.total.desdeDias !== null && vista.total.desdeDias < vista.ventanaCierreDias
        ? <p className="text-muted-foreground">El ROAS de este periodo todavía va a subir.</p> : null}
    </section>
    <section className="space-y-1"><h3 className="font-medium">TRM usada</h3>
      <p className="text-muted-foreground">{vista.trmEtiqueta ?? "No hay una TRM aplicada en este periodo."}</p>
      {vista.diasSinTrm.length > 0 ? <p className="text-muted-foreground">Días sin TRM: {vista.diasSinTrm.map(fecha).join(", ")}.</p> : null}
    </section>
    {mostrarCoberturaGasto ? <section className="space-y-1"><h3 className="font-medium">Cobertura del gasto</h3>
      <p className="text-muted-foreground">{vista.coberturaGasto.primerDia === null || vista.coberturaGasto.ultimoDia === null
        ? "No hay gasto de Meta cargado."
        : `Hay gasto de Meta desde el ${fecha(vista.coberturaGasto.primerDia)} hasta el ${fecha(vista.coberturaGasto.ultimoDia)}.`}</p>
    </section> : null}
    <section className="space-y-1"><h3 className="font-medium">Cobertura del origen</h3><ul className="space-y-1 text-muted-foreground">
      <li>Con anuncio: <span className="cifra">{num(cobertura.anuncio)}</span>. Se miden hasta el anuncio.</li>
      <li>Solo campaña o conjunto: <span className="cifra">{num(cobertura.soloCampanaOConjunto)}</span>. Se miden por campaña: el link manda el id de la campaña, o ningún id y solo su nombre.</li>
      <li>Sin campaña de Meta: <span className="cifra">{num(cobertura.sinCampana)}</span>. No se pueden atribuir y van en su propia fila.</li>
    </ul></section>
    {vista.total.sinValorVendido > 0 ? <section className="space-y-1"><h3 className="font-medium">Ventas sin valor vendido</h3><p className="text-muted-foreground">
      <span className="cifra">{num(vista.total.sinValorVendido)}</span>: el closer no escribió el valor vendido; cuentan como venta pero suman 0 al valor vendido.</p></section> : null}
    <section className="space-y-1"><h3 className="font-medium">Citas sin marcar</h3><p className="text-muted-foreground">
      <span className="cifra">{num(vista.citasSinMarcar)}</span>: el closer no marcó realizada o no asistió.
    </p></section>
  </ComoSeCalcula>;
}

/**
 * La tabla única de Pauta (ticket 355): un cargador y una tabla. "Ver por: Campaña de Meta | Canal" cambia la
 * agrupación con un parámetro de la URL. El gasto por canal no se puede repartir (Meta lo da por anuncio), así que
 * la vista por canal oculta Gasto y ROAS (decisión de Mani, 9-nov); el resto de columnas es el mismo.
 */
export function PautaRoas({ vista, enlace, hrefCsv, verPor, hrefVerPor, soloConteos = false }: {
  vista: VistaRoasDePauta;
  enlace: Enlace;
  hrefCsv: string;
  verPor: VerPorPauta;
  hrefVerPor: (v: VerPorPauta) => string;
  /** La vista "todos los programas" muestra solo conteos: ninguna tasa, gasto ni ROAS cruza programas (ADR 0048). */
  soloConteos?: boolean;
}) {
  const primera = verPor === "campana" ? "Campaña › conjunto › anuncio" : "Canal";
  const sinGasto = verPor === "canal";
  return <Card aria-labelledby="roas-pauta"><CardHeader><div className="flex flex-wrap items-start justify-between gap-2">
    <div className="space-y-1"><CardTitle id="roas-pauta">Pauta: origen, embudo y {VOCABULARIO_PAUTA_SEMANAL.roas}</CardTitle>
      <p className="text-xs text-muted-foreground">{UNIVERSO_PAUTA}</p>
      <p className="text-sm text-muted-foreground">Envíos pagos del periodo, anclados a la cohorte de registro. Toca una fila para profundizar o una cifra para ver sus personas.</p></div>
    <div className="flex flex-wrap items-center gap-2">{soloConteos ? null : <><InformacionRoas vista={vista} /><Link href={hrefCsv} className={claseEnlace}>Descargar citas (CSV)</Link></>}</div>
  </div>
    <div className="flex flex-wrap items-center gap-2 pt-2 text-sm">
      <span className="text-muted-foreground">Ver por:</span>
      {(["campana", "canal"] as const).map((v) => v === verPor
        ? <Badge key={v} variant="info">{v === "campana" ? "Campaña de Meta" : "Canal"}</Badge>
        : <Link key={v} href={hrefVerPor(v)} className={claseEnlace}>{v === "campana" ? "Campaña de Meta" : "Canal"}</Link>)}
    </div>
  </CardHeader><CardContent className="space-y-3">
    <Tabla cabeceras={CABECERAS(primera, soloConteos, sinGasto)}>
      <Fila fila={vista.total} enlace={enlace} soloConteos={soloConteos} sinGasto={sinGasto} />
      {verPor === "campana" ? <>
        {vista.campanas.map((campana) => <FilaDeCampana key={campana.id} id={campana.id!} nombre={campana.nombre} detalle={detalleDeCampana(vista, campana, enlace)}>
          <Celdas fila={campana} enlace={enlace} soloConteos={soloConteos}
            nombre={<button type="button" className="rounded-lg break-words text-left font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">▸ {campana.nombre}</button>} />
        </FilaDeCampana>)}
        {(vista.sinAnuncio.registros > 0 || vista.sinAnuncio.agendas > 0 || vista.sinAnuncio.ventas > 0)
          ? <Fila fila={vista.sinAnuncio} enlace={enlace} soloConteos={soloConteos} /> : null}
      </> : vista.canales.map((canal) => <Fila key={canal.id} fila={canal} enlace={enlace} soloConteos={soloConteos} sinGasto={sinGasto} />)}
    </Tabla>
    <NotaReconciliacion reconciliacion={vista.reconciliacion} />
  </CardContent></Card>;
}
