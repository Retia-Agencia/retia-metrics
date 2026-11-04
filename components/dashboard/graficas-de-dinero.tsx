import { Card, CardContent } from "@/components/ui/card";
import { Grafica } from "@/components/graficas/grafica";
import { InterruptoresDeGrafica } from "@/components/graficas/interruptores";
import { fecha, monto, num, usd } from "@/lib/format";
import { nombreCorto } from "@/lib/vocabulario-metricas";
import { sumarDias } from "@/lib/rangos";
import type { SeriesDeDinero, VentanaDeDinero } from "@/lib/queries/series-dinero";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";
import { urlDeLista } from "@/lib/queries/vista-metrica";
import type { Rango } from "@/lib/queries/dashboard";
import {
  configDeGraficaEnOrigen,
  desplazarAlEjeDeA,
  diaCorto,
  etiquetaDeTramo,
  nombreDeMes,
  pasoPorDefecto,
  tramosDe,
  valoresPorTramo,
  type ConfigDeGrafica,
  type Tramo,
} from "@/lib/series-pasos";

function nombreDeRango(rango: Rango): string {
  const mismoMes = rango.desde.slice(0, 7) === rango.hasta.slice(0, 7);
  return mismoMes && rango.desde.endsWith("-01") ? nombreDeMes(rango.desde) : `${diaCorto(rango.desde)} a ${diaCorto(rango.hasta)}`;
}

function nombresDeLeyenda(vista: VistaDelDashboard, datos: SeriesDeDinero) {
  const { elegida, opciones, cohorteIdDeB, cohorteId } = vista.filtroDeCohorte;
  const nombreA = cohorteId && elegida ? elegida.codigo : nombreDeRango(datos.a.rango);
  let nombreB: string | null = null;
  if (datos.b) {
    const codigoDeB = opciones.find((opcion) => opcion.id === cohorteIdDeB)?.codigo;
    nombreB = cohorteIdDeB && cohorteIdDeB !== cohorteId && codigoDeB
      ? `${codigoDeB} al mismo día de venta`
      : `${nombreDeRango(datos.b.rango)} al mismo día`;
    if (nombreB === nombreA) nombreB = `${nombreB} (comparación)`;
  }
  return { nombreA, nombreB };
}

function rangoDelTramo(tramo: Tramo, config: ConfigDeGrafica, desde: string, salto = 0): Rango {
  return {
    desde: config.forma === "acum" ? desde : sumarDias(tramo.desde, salto),
    hasta: sumarDias(tramo.hasta, salto),
  };
}

function frescuraDe(tramos: Tramo[], config: ConfigDeGrafica, hasta: string): string {
  const ultimo = tramos.at(-1);
  const enCurso = !ultimo?.enCurso ? "" : config.paso === "semana"
    ? " · la última semana sigue en curso"
    : config.paso === "mes"
      ? " · el último mes sigue en curso"
      : " · el último día sigue en curso";
  return `Datos hasta ${fecha(ultimo?.hasta ?? hasta)}${enCurso}`;
}

/** Las dos lecturas de Dinero comparten paso y forma; la moneda vive siempre en el tooltip. */
export function GraficasDeDinero({ datos, vista, slug, origen, hoy, conListas }: {
  datos: SeriesDeDinero;
  vista: VistaDelDashboard;
  slug: string;
  origen: string;
  hoy: string;
  conListas: boolean;
}) {
  const { a, b, meta, monedas } = datos;
  const { nombreA, nombreB } = nombresDeLeyenda(vista, datos);
  const predeterminada: ConfigDeGrafica = { unidad: "cupos", paso: pasoPorDefecto(a.rango), forma: "acum" };
  const config = configDeGraficaEnOrigen(origen, "dinero", predeterminada, { unidadFija: "cupos" });
  const tramos = tramosDe(a.rango, config.paso, hoy);
  const etiquetas = tramos.map(etiquetaDeTramo);
  const cohorteA = vista.filtroDeCohorte.cohorteId;
  const cohorteB = vista.filtroDeCohorte.cohorteIdDeB;
  const saltoB = b ? (Date.parse(b.rango.desde) - Date.parse(a.rango.desde)) / 86_400_000 : 0;
  const sufijoDePunto = (tramo: Tramo) => {
    if (config.paso === "dia") return `${config.forma === "acum" ? "hasta el " : ""}${diaCorto(tramo.desde)}`;
    if (config.paso === "semana") return `${config.forma === "acum" ? "hasta la " : ""}semana del ${diaCorto(tramo.desde)}`;
    return `${config.forma === "acum" ? "hasta " : ""}${nombreDeMes(tramo.desde).toLowerCase()}`;
  };

  const rangoDe = (tramo: Tramo, ventana: VentanaDeDinero) => rangoDelTramo(
    tramo, config, ventana.rango.desde, ventana === b ? saltoB : 0,
  );
  const enlace = (metrica: "cierres" | "caja", rango: Rango, cohorteId: string | null) => conListas
    ? urlDeLista({ slug, metrica, periodo: { preset: "custom", a: rango, b: null }, origen, claveCloser: vista.claveCloser, cohorteId })
    : null;
  const resumen = (metrica: "cierres" | "caja", rango: Rango, cohorteId: string | null) => conListas
    ? { metrica, desde: rango.desde, hasta: rango.hasta, cohorteId, claveCloser: vista.claveCloser }
    : null;

  const serie = (
    ventana: VentanaDeDinero,
    nombre: string,
    cohorteId: string | null,
    metrica: "cierres" | "caja",
    porDia: ReadonlyMap<string, number>,
    extras: Array<Array<{ etiqueta: string; texto: string }>>,
    hastaDatos?: string,
  ) => ({
    clave: nombre,
    valores: valoresPorTramo(porDia, tramos, config.forma, hastaDatos),
    enlaces: tramos.map((tramo) => hastaDatos && tramo.hasta > hastaDatos ? null : enlace(metrica, rangoDe(tramo, ventana), cohorteId)),
    resumenes: tramos.map((tramo) => hastaDatos && tramo.hasta > hastaDatos ? null : resumen(metrica, rangoDe(tramo, ventana), cohorteId)),
    extras,
    ...(ventana === b ? { punteada: true } : {}),
  });

  const ventasA = serie(a, nombreA, cohorteA, "cierres", a.cuposPorDia,
    valoresPorTramo(a.usdPorDia, tramos, config.forma)
      .map((valor) => [{ etiqueta: nombreCorto("vendido"), texto: usd(valor ?? 0) }]));
  const valoresDeCaja = (ventana: VentanaDeDinero) => {
    const porMoneda = new Map(monedas.map((moneda) => [moneda,
      valoresPorTramo(ventana.cajaPorMoneda.get(moneda) ?? new Map(), tramos, config.forma)]));
    return tramos.map((_, indice) => monedas.map((moneda) => ({
      etiqueta: nombreCorto("entro_a_caja"), texto: monto(porMoneda.get(moneda)![indice] ?? 0, moneda),
    })));
  };
  const cajaA = serie(a, nombreA, cohorteA, "caja", a.cuposConAbonoPorDia, valoresDeCaja(a));

  let ventasB: ReturnType<typeof serie> | null = null;
  let cajaB: ReturnType<typeof serie> | null = null;
  if (b && nombreB) {
    const cupos = desplazarAlEjeDeA(b.cuposPorDia, a.rango, b.rango);
    const vendido = desplazarAlEjeDeA(b.usdPorDia, a.rango, b.rango);
    ventasB = serie(b, nombreB, cohorteB, "cierres", cupos.porDia,
      valoresPorTramo(vendido.porDia, tramos, config.forma, vendido.hastaDatos)
        .map((valor) => [{ etiqueta: nombreCorto("vendido"), texto: usd(valor ?? 0) }]), cupos.hastaDatos);
    const cuposCaja = desplazarAlEjeDeA(b.cuposConAbonoPorDia, a.rango, b.rango);
    const cajaAlineada = new Map(monedas.map((moneda) => [moneda,
      desplazarAlEjeDeA(b.cajaPorMoneda.get(moneda) ?? new Map(), a.rango, b.rango)]));
    const extrasCajaB = tramos.map((_, indice) => monedas.map((moneda) => {
      const alineada = cajaAlineada.get(moneda)!;
      const valor = valoresPorTramo(alineada.porDia, tramos, config.forma, alineada.hastaDatos)[indice] ?? 0;
      return { etiqueta: nombreCorto("entro_a_caja"), texto: monto(valor, moneda) };
    }));
    cajaB = serie(b, nombreB, cohorteB, "caja", cuposCaja.porDia, extrasCajaB, cuposCaja.hastaDatos);
  }

  const grafica = (titulo: string, series: Array<ReturnType<typeof serie>>, conMeta: boolean) => <Card className="min-w-0">
    <CardContent className="pt-6">
      <Grafica
        titulo={titulo}
        unidad="cupos"
        frescura={frescuraDe(tramos, config, a.rango.hasta)}
        etiquetas={etiquetas}
        formato={(valor) => num(valor)}
        comparacion={b && nombreB ? { texto: "contra la comparación elegida", pares: [{ actual: nombreA, referencia: nombreB }] } : undefined}
        meta={conMeta && config.forma === "acum" && meta.cupos !== null
          ? { etiqueta: meta.etiqueta, valores: tramos.map(() => meta.cupos), color: 1 }
          : undefined}
        datos={{ dias: tramos.map((tramo) => tramo.desde), series }}
        punto={conListas ? { slug, origen, titulos: tramos.map((tramo) => `${titulo} · ${sufijoDePunto(tramo)}`) } : undefined}
      />
    </CardContent>
  </Card>;

  return <div className="space-y-4">
    <InterruptoresDeGrafica origen={origen} clave="dinero" config={config} sinUnidad />
    {a.sinValorVendido > 0 ? <p className="text-sm text-muted-foreground">{num(a.sinValorVendido)} cupos sin valor vendido no suman al {nombreCorto("vendido")}.</p> : null}
    <div className="grid min-w-0 gap-4 lg:grid-cols-2">
      {grafica("Cupos vendidos", [ventasA, ...(ventasB ? [ventasB] : [])], true)}
      {grafica(nombreCorto("cupos_con_caja"), [cajaA, ...(cajaB ? [cajaB] : [])], false)}
    </div>
  </div>;
}
