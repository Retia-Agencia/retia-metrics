import Link from "next/link";
import { Cifra } from "@/components/cifra-con-lista";
import { Pestanas } from "@/components/layout/pestanas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cop, fecha, usd } from "@/lib/format";
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
  /** Cupos o Plata, de la URL, y los enlaces del interruptor. */
  unidad?: UnidadDeCumplimiento;
  hrefDeUnidad?: Record<UnidadDeCumplimiento, string>;
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

/** Cupos o Plata (420, diseño §4.1): las ventas en cantidad o en valor vendido; agendas y presupuesto no cambian. */
export type UnidadDeCumplimiento = "cupos" | "plata";

export function unidadDeCumplimiento(valor: string | string[] | undefined): UnidadDeCumplimiento {
  return valor === "plata" ? "plata" : "cupos";
}

/** La fila del ritmo (420, diseño §4.1): agendas por día real, necesarias e inversión por día necesaria. */
function cifrasDelRitmo(datos: CumplimientoDeCohorteLeido, filtros: ReadonlyArray<readonly [string, string]>): CifraDeMetrica[] {
  const cifras: CifraDeMetrica[] = [];
  const periodo = "desde que abrió la venta de la cohorte hasta hoy";
  if (datos.agendasPorDia) {
    const { agendas, diasHabiles, valor } = datos.agendasPorDia;
    cifras.push(armarCifra({
      concepto: "agendas_dia", explicacion: explicacionDePauta("agendas_dia"), valor,
      motivo: valor === null ? "La venta de la cohorte abrió hoy: todavía no hay un día hábil completo." : undefined,
      partes: [agendas, diasHabiles], periodo, filtros,
      linea: { antes: "Promedio real de la cohorte" },
    }));
  }
  const r = datos.requeridos;
  if (r && !r.metaCumplida) {
    const porDia = r.agendasDia.valor;
    cifras.push(armarCifra({
      concepto: "agendas_req", explicacion: explicacionDePauta("agendas_req"), valor: porDia,
      motivo: porDia === null ? r.agendasDia.razon ?? "No hay tasas medidas con qué calcularlo." : undefined,
      periodo: `de hoy al cierre, el ${fecha(r.cierre)}`, filtros,
      linea: { antes: "Hasta el cierre, el ", cifra: fecha(r.cierre) },
    }));
    cifras.push(armarCifra({
      concepto: "inversion_req", explicacion: explicacionDePauta("inversion_req"), valor: r.inversionDiaMeta,
      motivo: r.inversionDiaMeta === null
        ? porDia === null ? "Sin agendas por día necesarias, no hay con qué multiplicar." : "Sin costo por agenda objetivo cargado para la cohorte."
        : undefined,
      partes: [porDia, r.costoPorAgendaMeta], periodo: `de hoy al cierre, el ${fecha(r.cierre)}`, filtros,
      linea: r.inversionDiaPromedio === null ? undefined : { antes: "Al costo promedio real: ", cifra: cop(r.inversionDiaPromedio) },
      notas: r.costoPorAgendaPromedio === null ? undefined : [["Costo promedio real", `${cop(r.costoPorAgendaPromedio)} por agenda: la inversión de la cohorte entre sus agendadas.`]],
    }));
  }
  return cifras;
}

export function CumplimientoVista({ datos, slug, programa, evidencia = {}, unidad = "cupos", hrefDeUnidad }: {
  datos: CumplimientoDeCohorteLeido;
  slug: string;
  programa?: string;
  evidencia?: EvidenciaDeCumplimiento;
  unidad?: UnidadDeCumplimiento;
  /** El enlace de cada lado del interruptor Cupos | Plata; sin él no se muestra. */
  hrefDeUnidad?: Record<UnidadDeCumplimiento, string>;
}) {
  const titulo = <CardTitle>¿Vamos a llegar a la meta de la cohorte?</CardTitle>;
  if (!datos.cohorte) return <Card data-testid="cumplimiento-cohorte">
    <CardHeader>{titulo}</CardHeader>
    <CardContent><p className="text-sm text-muted-foreground">Sin cohorte activa</p></CardContent>
  </Card>;
  const filtros: ReadonlyArray<readonly [string, string]> = [
    ...(programa ? [["Programa", programa] as const] : []),
    ["Cohorte", datos.cohorte.codigo],
  ];
  // La fracción de tiempo de la cohorte es la misma para toda meta: la da la barra de ventas totales, que siempre existe.
  const totales = datos.ventasTotales?.cupos;
  const fraccion = totales && totales.esperado !== null && totales.meta > 0 ? totales.esperado / totales.meta : null;
  const enPlata = unidad === "plata";
  const barraDeVentas = (barra: NonNullable<CumplimientoDeCohorteLeido["ventasPauta"]>, cupos: ClaveDeExplicacionDePauta, plata: ClaveDeExplicacionDePauta, de: string, lista?: ListaDeCifra) =>
    enPlata && barra.usd
      ? cifraDeAvance(plata, barra.usd, filtros, `vendido ${de}`, { lista })
      : cifraDeAvance(cupos, barra.cupos, filtros, `ventas ${de}`, { lista });
  const ritmo = cifrasDelRitmo(datos, filtros);
  return <Card data-testid="cumplimiento-cohorte">
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {titulo}
          <p className="text-xs text-muted-foreground">Cohorte {datos.cohorte.codigo}. Solo cambia con la cohorte: el periodo y los demás filtros no la mueven.</p>
        </div>
        {hrefDeUnidad ? <Pestanas
          grupos={[{ pestanas: [
            { id: "cupos", etiqueta: "Cupos", descripcion: "Las ventas en cantidad.", href: hrefDeUnidad.cupos },
            { id: "plata", etiqueta: "Plata", descripcion: "Las ventas en valor vendido, en dólares.", href: hrefDeUnidad.plata },
          ] }]}
          activa={unidad}
          etiqueta="Ver en"
        /> : null}
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {datos.agendas
          ? <Cifra cifra={cifraDeAvance("agendas_total", datos.agendas.cupos, filtros, "agendas")} />
          : <section className="space-y-1 rounded-xl bg-muted p-3.5"><p className="text-sm">Sin meta de agendas para esta cohorte</p><Configurar slug={slug} /></section>}
        {datos.ventasPauta
          ? <Cifra cifra={barraDeVentas(datos.ventasPauta, "ventas", "vendido_pauta", "de pauta", evidencia.ventasPauta)} />
          : <section className="space-y-1 rounded-xl bg-muted p-3.5"><p className="text-sm">Sin meta de ventas de pauta para esta cohorte</p><Configurar slug={slug} /></section>}
        {datos.ventasTotales ? <Cifra cifra={barraDeVentas(datos.ventasTotales, "ventas_total", "vendido_total", "total", evidencia.ventasTotales)} /> : null}
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
      {ritmo.length > 0 ? <div className="grid gap-3 sm:grid-cols-3" aria-label="Ritmo">
        {ritmo.map((cifra) => <Cifra key={cifra.concepto} cifra={cifra} />)}
      </div> : null}
      {datos.cohorte.cerrada ? <p className="text-sm font-medium">La cohorte ya cerró</p> : null}
      {datos.requeridos?.metaCumplida ? <p className="text-sm font-medium">Meta cumplida: no hace falta más inversión</p> : null}
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
  return <CumplimientoVista datos={datos} slug={props.slug} programa={props.programa} evidencia={evidencia} unidad={props.unidad} hrefDeUnidad={props.hrefDeUnidad} />;
}
