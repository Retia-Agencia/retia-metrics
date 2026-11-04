import { Card, CardContent } from "@/components/ui/card";
import { Grafica } from "@/components/graficas/grafica";
import { InterruptoresDeGrafica } from "@/components/graficas/interruptores";
import { fecha, num } from "@/lib/format";
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

/** Un rango se nombra como un negocio lo diría: "Octubre" si es un mes entero o a medias desde el día 1. */
function nombreDeRango(rango: Rango): string {
  const mismoMes = rango.desde.slice(0, 7) === rango.hasta.slice(0, 7);
  return mismoMes && rango.desde.endsWith("-01") ? nombreDeMes(rango.desde) : `${diaCorto(rango.desde)} a ${diaCorto(rango.hasta)}`;
}

/** Los nombres de la leyenda: "C3" y "C2 al mismo día de venta", o "Octubre" y "Septiembre al mismo día". */
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

interface Definicion {
  clave: string;
  titulo: string;
  unidad: string;
  decimales: number;
  porDia: (ventana: VentanaDeDinero) => Map<string, number>;
  lista: "cierres" | "contratado" | "caja" | null;
  moneda?: string;
  meta: number | null;
}

/**
 * Las gráficas de Dinero (ticket 370): el eje es el periodo elegido, con los mismos filtros de cohorte,
 * periodo y closer que las cifras. Una gráfica de ventas (cupos o plata) y una de caja (cupos con abono o
 * plata por moneda), cada una con su unidad, su paso y su forma en la URL. La comparación es la de
 * "Comparar con": el día N de venta del periodo contra el día N de B.
 */
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
  const pasoInicial = pasoPorDefecto(a.rango);
  const predeterminada: ConfigDeGrafica = { unidad: "cupos", paso: pasoInicial, forma: "acum" };
  const configVentas = configDeGraficaEnOrigen(origen, "ventas", predeterminada);
  const configCaja = configDeGraficaEnOrigen(origen, "caja", predeterminada);
  const claveCloser = vista.claveCloser;

  const definicionesDe = (grupo: "ventas" | "caja", config: ConfigDeGrafica): Definicion[] => {
    if (grupo === "ventas") {
      return config.unidad === "cupos"
        ? [{ clave: "ventas-cupos", titulo: "Cupos vendidos", unidad: "cupos", decimales: 0, porDia: (v) => v.cuposPorDia, lista: "cierres", meta: meta.cupos }]
        : [{ clave: "ventas-usd", titulo: nombreCorto("vendido"), unidad: "USD", decimales: 2, porDia: (v) => v.usdPorDia, lista: "contratado", meta: meta.usd }];
    }
    if (config.unidad === "cupos") {
      return [{ clave: "caja-cupos", titulo: nombreCorto("cupos_con_caja"), unidad: "cupos", decimales: 0, porDia: (v) => v.cuposConAbonoPorDia, lista: null, meta: null }];
    }
    return monedas.map((moneda) => ({
      clave: `caja-${moneda}`, titulo: nombreCorto("entro_a_caja"), unidad: moneda, decimales: moneda === "COP" ? 0 : 2,
      porDia: (v: VentanaDeDinero) => v.cajaPorMoneda.get(moneda) ?? new Map<string, number>(),
      lista: "caja" as const, moneda, meta: null,
    }));
  };

  const enlace = (lista: Definicion["lista"], rango: Rango, cohorteId: string | null, moneda?: string) => {
    if (!conListas || !lista || rango.desde > rango.hasta) return null;
    return urlDeLista({ slug, metrica: lista, periodo: { preset: "custom", a: rango, b: null }, origen, claveCloser, cohorteId, moneda });
  };
  const rangoDelTramo = (tramo: Tramo, config: ConfigDeGrafica, desde: string, salto = 0): Rango => ({
    desde: config.forma === "acum" ? desde : sumarDias(tramo.desde, salto),
    hasta: sumarDias(tramo.hasta, salto),
  });

  const pintar = (config: ConfigDeGrafica, definicion: Definicion) => {
    const tramos = tramosDe(a.rango, config.paso, hoy);
    const etiquetas = tramos.map(etiquetaDeTramo);
    const desplazada = b ? desplazarAlEjeDeA(definicion.porDia(b), a.rango, b.rango) : null;
    const saltoDeB = b ? (Date.parse(b.rango.desde) - Date.parse(a.rango.desde)) / 86_400_000 : 0;
    const cohorteDeB = vista.filtroDeCohorte.cohorteIdDeB;
    const cohorteDeA = vista.filtroDeCohorte.cohorteId;
    const meta_ = config.forma === "acum" ? definicion.meta : null;
    return (
      <Card key={definicion.clave} className="min-w-0">
        <CardContent className="pt-6">
          <Grafica
            titulo={`${definicion.titulo} ${config.forma === "acum" ? "acumulado" : `por ${config.paso === "dia" ? "día" : config.paso}`}`}
            unidad={definicion.unidad}
            frescura={`Datos hasta ${fecha(tramos.at(-1)?.hasta ?? a.rango.hasta)}.${tramos.at(-1)?.enCurso ? " El último tramo sigue en curso." : ""}`}
            etiquetas={etiquetas}
            formato={(valor) => num(valor, definicion.decimales)}
            comparacion={b && nombreB ? { texto: "contra la comparación elegida", pares: [{ actual: nombreA, referencia: nombreB }] } : undefined}
            meta={meta_ === null ? undefined : { etiqueta: meta.etiqueta, valores: tramos.map(() => meta_), color: 1 }}
            datos={{
              dias: tramos.map((tramo) => tramo.desde),
              series: [
                {
                  clave: nombreA,
                  valores: valoresPorTramo(definicion.porDia(a), tramos, config.forma),
                  enlaces: tramos.map((tramo) => enlace(definicion.lista, rangoDelTramo(tramo, config, a.rango.desde), cohorteDeA, definicion.moneda)),
                },
                ...(b && nombreB && desplazada ? [{
                  clave: nombreB, punteada: true,
                  valores: valoresPorTramo(desplazada.porDia, tramos, config.forma, desplazada.hastaDatos),
                  enlaces: tramos.map((tramo) => tramo.hasta > desplazada.hastaDatos ? null
                    : enlace(definicion.lista, rangoDelTramo(tramo, config, b.rango.desde, saltoDeB), cohorteDeB, definicion.moneda)),
                }] : []),
              ],
            }}
          />
        </CardContent>
      </Card>
    );
  };

  const sinValor = a.sinValorVendido;
  return (
    <div className="space-y-4">
      <div className="space-y-1 text-sm text-muted-foreground">
        <p>
          Del {fecha(a.rango.desde)} al {fecha(a.rango.hasta < hoy ? a.rango.hasta : hoy)}, con los mismos filtros de cohorte,
          periodo y closer de las cifras. {b ? "La línea punteada es la comparación elegida, día a día desde su primer día de venta. " : ""}
          Un tramo en curso todavía no termina: no lo leas como una caída.
        </p>
        {claveCloser ? <p>Muestra la contribución del closer seleccionado; la meta es del programa entero y no se reparte.</p> : null}
        {sinValor > 0 && configVentas.unidad === "plata" ? <p>Hay {num(sinValor)} cupos sin valor vendido: cuentan como cupos, pero no suman al vendido.</p> : null}
      </div>

      <section className="space-y-3" aria-label="Ventas">
        <h3 className="text-base font-medium">Ventas</h3>
        <InterruptoresDeGrafica origen={origen} clave="ventas" config={configVentas} />
        <div className="grid min-w-0 gap-4 xl:grid-cols-2">
          {definicionesDe("ventas", configVentas).map((definicion) => pintar(configVentas, definicion))}
        </div>
        <p className="text-xs text-muted-foreground">{configVentas.unidad === "cupos" ? "Cupos es el número de ventas (deals en Abonado o Completo) del tramo." : "Plata es el Vendido, en USD: el valor vendido de las ventas del tramo."}</p>
      </section>

      <section className="space-y-3" aria-label="Caja">
        <h3 className="text-base font-medium">Caja</h3>
        <InterruptoresDeGrafica origen={origen} clave="caja" config={configCaja} />
        <p className="text-xs text-muted-foreground">
          {configCaja.unidad === "cupos"
            ? "Cupos con caja: cada deal cuenta una vez, el día de su primer abono del periodo. Un segundo abono del mismo deal no suma otro cupo."
            : "Plata es lo que entró por fecha de abono, en su moneda y sin convertir."}
        </p>
        {configCaja.unidad === "plata" && monedas.length === 0
          ? <p className="text-sm text-muted-foreground">Sin abonos vigentes en el periodo para el filtro elegido.</p>
          : <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              {definicionesDe("caja", configCaja).map((definicion) => pintar(configCaja, definicion))}
            </div>}
      </section>
    </div>
  );
}
