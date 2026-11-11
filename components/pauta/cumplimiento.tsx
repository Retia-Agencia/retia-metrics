import Link from "next/link";
import { Cifra } from "@/components/cifra-con-lista";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cop, fecha, num, usd } from "@/lib/format";
import {
  leerCumplimientoDeCohorte,
  leerEvidenciaDeVentas,
  type CumplimientoDeCohorteLeido,
  type MedidaDeCumplimiento,
} from "@/lib/metas/cumplimiento-de-cohorte";
import { armarCifra, type CifraDeMetrica, type EntradaDeCifra } from "@/lib/metricas/cifra";
import { explicacionDePauta, type ClaveDeExplicacionDePauta } from "@/lib/metricas/explicaciones-de-pauta";
import type { ListaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { nombreDeEtapa, urlDeLista } from "@/lib/queries/vista-metrica";

export interface PropsCumplimientoDeCohorte {
  programId: string;
  slug: string;
  cohorteId: string | null;
  hoy: string;
  /** El nombre del programa, para "Calculada con". */
  programa?: string;
  /** El origen de la pantalla, para que la lista completa sepa volver. */
  origen?: string;
  /** La sesión abre la lista de ventas (la misma reja de la página de lista): solo así la barra trae su evidencia. */
  puedeVerVentas?: boolean;
}

type ListaDeCifra = NonNullable<EntradaDeCifra["lista"]>;

/** Las barras de ventas con su evidencia: la lista de ventas que cuenta lo mismo que la barra (419). */
export interface EvidenciaDeCumplimiento {
  ventasTotales?: ListaDeCifra;
  ventasPauta?: ListaDeCifra;
}

/** Cinco filas como en el boceto: persona, etapa y valor vendido. */
export function listaDeVentas(seccion: ListaDeMetrica, href: string): ListaDeCifra {
  return {
    href,
    nombre: "ventas",
    total: seccion.subtotal.cantidad,
    filas: seccion.filas.slice(0, 5).map((fila) => [
      fila.persona?.nombre ?? "Sin nombre",
      fila.etapa ? nombreDeEtapa(fila.etapa) : "—",
      fila.monto === null ? "—" : usd(fila.monto),
    ]),
  };
}

function Configurar({ slug }: { slug: string }) {
  const href = `/p/${encodeURIComponent(slug)}/programa?seccion=ventas`;
  return <Button size="sm" variant="link" nativeButton={false} render={<Link href={href} />}>Configurar</Button>;
}

/**
 * Una barra del cumplimiento como Cifra (419): la arma el servidor con `armarCifra`, y la tarjeta solo la pinta.
 * El cumplimiento no sigue el periodo: solo programa y cohorte en "Calculada con" (diseño §2 punto 4).
 */
function cifraDeAvance(concepto: ClaveDeExplicacionDePauta, medida: MedidaDeCumplimiento, filtros: ReadonlyArray<readonly [string, string]>, de: string, extra: Partial<EntradaDeCifra> = {}): CifraDeMetrica {
  const conEsperado = medida.esperado !== null && medida.meta > 0;
  return armarCifra({
    concepto,
    explicacion: explicacionDePauta(concepto),
    valor: medida.llevamos,
    periodo: "desde que abrió la venta de la cohorte hasta hoy",
    filtros,
    avance: conEsperado
      ? { llevamos: medida.llevamos, meta: medida.meta, esperado: medida.esperado!, fraccionDeTiempo: medida.esperado! / medida.meta, de }
      : undefined,
    estado: conEsperado ? { fuente: "esperado", llevamos: medida.llevamos, esperado: medida.esperado! } : undefined,
    ...extra,
  });
}

export function CumplimientoVista({ datos, slug, programa, evidencia = {} }: { datos: CumplimientoDeCohorteLeido; slug: string; programa?: string; evidencia?: EvidenciaDeCumplimiento }) {
  if (!datos.cohorte) return <Card data-testid="cumplimiento-cohorte">
    <CardHeader><CardTitle>¿Vamos a llegar a la meta de la cohorte?</CardTitle></CardHeader>
    <CardContent><p className="text-sm text-muted-foreground">Sin cohorte activa</p></CardContent>
  </Card>;
  const filtros: ReadonlyArray<readonly [string, string]> = [
    ...(programa ? [["Programa", programa] as const] : []),
    ["Cohorte", datos.cohorte.codigo],
  ];
  // La fracción de tiempo de la cohorte es la misma para toda meta: la da la barra de ventas totales, que siempre existe.
  const totales = datos.ventasTotales?.cupos;
  const fraccion = totales && totales.esperado !== null && totales.meta > 0 ? totales.esperado / totales.meta : null;
  return <Card data-testid="cumplimiento-cohorte">
    <CardHeader>
      <CardTitle>¿Vamos a llegar a la meta de la cohorte?</CardTitle>
      <p className="text-xs text-muted-foreground">Cohorte {datos.cohorte.codigo}. Solo cambia con la cohorte: el periodo y los demás filtros no la mueven.</p>
    </CardHeader>
    <CardContent className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {datos.agendas
          ? <Cifra cifra={cifraDeAvance("agendas_total", datos.agendas.cupos, filtros, "agendas")} />
          : <section className="space-y-1 rounded-xl bg-muted p-3.5"><p className="text-sm">Sin meta de agendas para esta cohorte</p><Configurar slug={slug} /></section>}
        {datos.ventasPauta
          ? <Cifra cifra={cifraDeAvance("ventas", datos.ventasPauta.cupos, filtros, "ventas de pauta", { lista: evidencia.ventasPauta })} />
          : <section className="space-y-1 rounded-xl bg-muted p-3.5"><p className="text-sm">Sin meta de ventas de pauta para esta cohorte</p><Configurar slug={slug} /></section>}
        {datos.ventasTotales ? <Cifra cifra={cifraDeAvance("ventas_total", datos.ventasTotales.cupos, filtros, "ventas", { lista: evidencia.ventasTotales })} /> : null}
        {datos.inversion ? <Cifra cifra={armarCifra({
          concepto: "presupuesto",
          explicacion: explicacionDePauta("presupuesto"),
          valor: datos.inversion.llevamos,
          periodo: "desde que abrió la venta de la cohorte hasta hoy",
          filtros,
          enMillones: true,
          avance: fraccion === null ? undefined : {
            llevamos: datos.inversion.llevamos,
            meta: datos.inversion.meta,
            esperado: datos.inversion.meta * fraccion,
            fraccionDeTiempo: fraccion,
            de: "inversión",
          },
          notas: [["Sin color", "Gastar más rápido o más lento de lo planeado no es bueno ni malo por sí solo: se lee junto al costo por agenda."]],
        })} /> : null}
      </div>
      {datos.cohorte.cerrada ? <p className="text-sm font-medium">La cohorte ya cerró</p> : null}
      {datos.requeridos ? <section className="space-y-2 rounded-lg bg-muted p-3" aria-label="Requeridos">
        {datos.requeridos.metaCumplida
          ? <p className="text-sm font-medium">Meta cumplida: no hace falta más inversión</p>
          : <>
            <p className="text-sm">
              {datos.requeridos.agendasDia.valor === null
                ? datos.requeridos.agendasDia.razon ?? "—"
                : <>Requiere <span className="cifra">{num(datos.requeridos.agendasDia.valor, 1)}</span> agendas/día hasta el {fecha(datos.requeridos.cierre)}</>}
            </p>
            <p className="text-xs text-muted-foreground">Inversión/día al costo meta: <span className="cifra">{datos.requeridos.inversionDiaMeta === null ? "—" : cop(datos.requeridos.inversionDiaMeta)}</span></p>
            <p className="text-xs text-muted-foreground">Inversión/día al promedio de la cohorte: <span className="cifra">{datos.requeridos.inversionDiaPromedio === null ? "—" : cop(datos.requeridos.inversionDiaPromedio)}</span></p>
          </>}
      </section> : null}
    </CardContent>
  </Card>;
}

export async function CumplimientoDeCohorte(props: PropsCumplimientoDeCohorte) {
  const datos = await leerCumplimientoDeCohorte(props.programId, props.cohorteId, props.hoy);
  const cohorte = datos.cohorte;
  const origen = props.origen;
  let evidencia: EvidenciaDeCumplimiento = {};
  if (cohorte && origen && props.puedeVerVentas) {
    const base = { programId: props.programId, cohorteId: cohorte.id, desde: cohorte.desdeLista, hoy: props.hoy };
    const href = (area?: "paid") => urlDeLista({
      slug: props.slug, metrica: "cierres", origen, cohorteId: cohorte.id,
      periodo: { preset: "custom", a: { desde: cohorte.desdeLista, hasta: props.hoy }, b: null, comparaciones: [] },
      ...(area ? { filtrosDeOrigen: { area } } : {}),
    });
    const [totales, pauta] = await Promise.all([
      leerEvidenciaDeVentas(base),
      datos.ventasPauta ? leerEvidenciaDeVentas({ ...base, area: "paid" }) : Promise.resolve(null),
    ]);
    evidencia = {
      ventasTotales: listaDeVentas(totales, href()),
      ...(pauta ? { ventasPauta: listaDeVentas(pauta, href("paid")) } : {}),
    };
  }
  return <CumplimientoVista datos={datos} slug={props.slug} programa={props.programa} evidencia={evidencia} />;
}
