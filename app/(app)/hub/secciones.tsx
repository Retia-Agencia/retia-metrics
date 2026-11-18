import { Enlace } from "@/components/enlace";
import { cloneElement, type ReactNode } from "react";
import { Cifra, CifraConLista } from "@/components/cifra-con-lista";
import { Operacion } from "@/components/dashboard/operacion";
import { Escalera } from "@/components/dashboard/escalera";
import { Tabla, Tarjeta, tasa } from "@/components/dashboard/piezas";
import { DealsContraAgendas } from "@/components/deals-contra-agendas";
import { Variacion } from "@/components/variacion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, usd } from "@/lib/format";
import { comparacionesDe, descripcionDeComparacion, nombreDePedido, type PeriodoResuelto } from "@/lib/periodo";
import { contextoDeCifra } from "@/lib/contexto-de-cifra";
import { urlDeLista } from "@/lib/queries/vista-metrica";
import { type FilaDePrograma, type VistaDeTodos } from "@/lib/queries/vista-todos";
import { nombreCorto, UNIVERSO_COMERCIAL } from "@/lib/vocabulario-metricas";
import { contextoDelDia, horizontesDeCupos } from "@/lib/queries/vista-hoy";
import { cifrasDeDinero } from "@/lib/hub/cifras-de-dinero";
import { explicacionesDeDinero } from "@/lib/hub/explicaciones-de-dinero";
import { cifrasDeConteosDeTodos, cifrasDeTasasDeUnPrograma, conNotaDeSuma, contextoDeTodos } from "@/lib/hub/cifras-de-todos";
import { explicacionesDeConteosDeTodos, explicacionesDeTasasDeTodos } from "@/lib/hub/explicaciones-de-todos";
import type { DatosDelHub } from "@/lib/queries/hub-todos";

type Seccion = "hoy" | "comercial" | "dinero";
const GRILLA = "grid gap-4 sm:grid-cols-2 xl:grid-cols-4";

/** Sin periodo de comparación no hay contra qué comparar: no se pinta nada. */
function ContraB({ actual, anterior, periodo, decimales }: { actual: number; anterior: number | null; periodo: PeriodoResuelto; decimales?: number }) {
  return anterior === null ? null : <p><Variacion actual={actual} anterior={anterior} decimales={decimales} comparacion={descripcionDeComparacion(periodo)} /></p>;
}

function TablaPorPrograma({ titulo, cabeceras, vista, seccion, celdas }: {
  titulo: string;
  cabeceras: string[];
  vista: VistaDeTodos;
  seccion: Seccion;
  celdas: (fila: FilaDePrograma) => ReactNode;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent>
        <Tabla cabeceras={["Programa", ...cabeceras]}>
          {vista.programas.map((fila) => (
            <tr key={fila.programa.id}>
              <td className="py-3">
                <Button variant="link" nativeButton={false} render={<Enlace precarga="al-pasar" href={`${fila.href}&seccion=${seccion}`} />}>{fila.programa.nombre}</Button>
              </td>
              {celdas(fila)}
            </tr>
          ))}
        </Tabla>
      </CardContent>
    </Card>
  );
}

/** Contra qué se compara, en palabras («el periodo anterior»), igual que el Hub de un programa. */
function referenciaDe(periodo: PeriodoResuelto): string | undefined {
  const primera = comparacionesDe(periodo)[0];
  return primera ? nombreDePedido(primera.pedido, periodo.preset) : undefined;
}

/**
 * Vendido · Recaudado · Por cobrar (369) y, aparte, lo que entró a caja en el periodo, una Cifra por moneda (nunca una
 * suma entre monedas). Las cuatro son sumas de los programas que la persona ve, en la misma unidad (ADR 0048).
 */
function VendidoYCaja({ vista, hoy }: { vista: VistaDeTodos; hoy: string }) {
  const caja = (t: { caja: VistaDeTodos["a"]["caja"] }) => t.caja.map((c) => ({ moneda: c.moneda, total: c.valor }));
  const cifras = cifrasDeDinero({
    dinero: vista.a.dinero, caja: caja(vista.a),
    anterior: vista.b ? { dinero: vista.b.dinero, caja: caja(vista.b) } : null,
    referencia: referenciaDe(vista.periodo),
    detalles: { contratado: vista.detalles.contratado, caja: vista.detalles.caja },
    explicaciones: explicacionesDeDinero(), contexto: contextoDeTodos(vista, hoy),
  });
  return <>
    {[cifras.vendido, cifras.recaudado, cifras.porCobrar, ...cifras.entroACaja].map(conNotaDeSuma).map((cifra) => (
      <Cifra key={`${cifra.concepto}:${cifra.explicacion.filtros.map(([, v]) => v).join("|")}`} cifra={cifra} />
    ))}
  </>;
}

/** Realizadas sin Grain y Llamadas sin resultado: aún sin ficha en el registro (pendiente del 419), conservan la tarjeta anterior. */
function ConteosDelPulso({ vista }: { vista: VistaDeTodos }) {
  const campos = [
    ["Realizadas sin Grain", "showsSinGrain", "shows_sin_grain"],
    ["Llamadas pasadas sin resultado", "sinResultado", "sin_resultado"],
  ] as const;
  return campos.map(([titulo, campo, metrica]) => (
    <Tarjeta key={campo} titulo={titulo} valor={
      <CifraConLista titulo={titulo} detalle={vista.detalles[metrica]}>{num(vista.a[campo].valor)}</CifraConLista>
    } nota={<ContraB actual={vista.a[campo].valor} anterior={vista.b?.[campo].valor ?? null} periodo={vista.periodo} />} />
  ));
}

/** Leads, Citas, Realizadas y Ventas: conteos sumables entre programas, una Cifra de total cada uno. */
function Conteos({ vista, hoy }: { vista: VistaDeTodos; hoy: string }) {
  const cifras = cifrasDeConteosDeTodos({
    vista, referencia: referenciaDe(vista.periodo), explicaciones: explicacionesDeConteosDeTodos(), contexto: contextoDeTodos(vista, hoy),
  });
  return cifras.map((cifra) => <Cifra key={cifra.concepto} cifra={cifra} />);
}

/** Las banderas del Pulso (ticket 191): foto de hoy, sin comparación; el % va por programa en su Hub. */
function Banderas({ vista }: { vista: VistaDeTodos }) {
  const { banderas } = vista;
  const campos = [
    ["Atendidos sin valor vendido", "sinValor", "atendidos_sin_valor"],
    ["Atendidos sin Grain", "sinGrain", "atendidos_sin_grain"],
    ["Cierre perdido con pagos registrados", "perdidosConPagos", "perdidos_con_pagos"],
  ] as const;
  return campos.map(([titulo, campo, metrica]) => (
    <Tarjeta key={campo} titulo={titulo} valor={
      <span className={banderas[campo].valor > 0 ? "text-tono-peligro" : undefined}>
        <CifraConLista titulo={titulo} detalle={vista.detalles[metrica]}>{num(banderas[campo].valor)}</CifraConLista>
      </span>
    } nota={metrica === "perdidos_con_pagos" ? "Plata cobrada sobre una venta perdida · a hoy" : `de ${num(banderas.atendidos.valor)} atendidos · a hoy`} />
  ));
}

/**
 * Hoy de cada programa lado a lado (252): en qué día de la cohorte va, sus ventas contra su meta de
 * hoy y el embudo del día. Nada de esto se suma entre programas (ADR 0048): es una fila por programa.
 */
/** La tasa de cada programa con su propia explicación: nunca una tasa combinada (ADR 0048). */
function tasasDe(fila: FilaDePrograma, vista: VistaDeTodos, hoy: string) {
  return cifrasDeTasasDeUnPrograma({
    fila, referencia: vista.b ? referenciaDe(vista.periodo) : undefined,
    explicaciones: explicacionesDeTasasDeTodos(), contexto: contextoDeTodos(vista, hoy),
  });
}

function HoyPorPrograma({ vista, hoy }: { vista: VistaDeTodos; hoy: string }) {
  return <TablaPorPrograma titulo="Hoy por programa" vista={vista} seccion="hoy"
    cabeceras={["Día de la cohorte", `${nombreCorto("ventas")} / objetivo de hoy`, nombreCorto("citas"), nombreCorto("shows"), nombreCorto("asistencia"), nombreCorto("cierre_de_ventas")]}
    celdas={(fila) => {
      const { cohorte } = contextoDelDia(hoy, fila.dashboard.cohorte);
      const [delDia] = horizontesDeCupos(fila.dashboard);
      const { embudo } = fila.dashboard;
      const tasas = tasasDe(fila, vista, hoy);
      return <>
        <td className="text-right">{cohorte ? `${cohorte.codigo}: ${num(cohorte.dia)} de ${num(cohorte.total)}` : "—"}</td>
        <td className="text-right">{num(delDia.real)} / {delDia.meta === null ? "—" : num(delDia.meta, 1)}</td>
        <td className="text-right">{num(embudo.agendas)}</td>
        <td className="text-right">{num(embudo.llamadasConShow)}</td>
        <td className="text-right"><Cifra tamano="celda" cifra={tasas.asistencia} /></td>
        <td className="text-right"><Cifra tamano="celda" cifra={tasas.cierreDeVentas} /></td>
      </>;
    }} />;
}

function VentasPorCohorte({ vista, origen }: { vista: VistaDeTodos; origen: string }) {
  return <Card>
    <CardHeader><CardTitle>Ventas por programa y cohorte</CardTitle></CardHeader>
    <CardContent>
      {vista.programas.every((p) => p.dashboard.ventasPorCohorte.length === 0) ? <p>Sin ventas en el periodo.</p> : (
        <Tabla cabeceras={["Programa", "Cohorte", "Ventas", nombreCorto("vendido"), nombreCorto("recaudado"), nombreCorto("por_cobrar")]}>
          {vista.programas.flatMap((fila) => fila.dashboard.ventasPorCohorte.map((cohorte) => {
            const href = cohorte.cohorteId ? urlDeLista({ slug: fila.programa.slug, metrica: "contratado", periodo: vista.periodo, origen, cohorteId: cohorte.cohorteId }) : null;
            return <tr key={`${fila.programa.id}:${cohorte.cohorteId}`}>
              <td className="py-2">{fila.programa.nombre}</td><td className="text-right">{cohorte.codigo ?? "Sin cohorte"}</td>
              <td className="text-right">{href ? <Button variant="link" nativeButton={false} render={<Enlace precarga="nunca" href={href} />}>{num(cohorte.ventas)}</Button> : num(cohorte.ventas)}</td>
              {[cohorte.dinero.vendido, cohorte.dinero.recaudado, cohorte.dinero.porCobrar].map((valor, i) => (
                <td key={i} className="text-right">{href ? <Button variant="link" nativeButton={false} render={<Enlace precarga="nunca" href={href} />}>{usd(valor)}</Button> : usd(valor)}</td>
              ))}
            </tr>;
          }))}
        </Tabla>
      )}
    </CardContent>
  </Card>;
}

/** Solo servidor: las piezas compartidas se importan, nunca se modifican. */
export function SeccionDeTodos({ vista, seccion, hoy, origen, comercial }: { vista: VistaDeTodos; seccion: Seccion; hoy: string; origen: string; comercial: DatosDelHub["comercial"] }) {
  if (seccion === "hoy") return <section id="hoy" className="space-y-4">
    <h2 className="text-xl font-semibold">Hoy</h2>
    <HoyPorPrograma vista={vista} hoy={hoy} />
    <div className={GRILLA}><VendidoYCaja vista={vista} hoy={hoy} /><ConteosDelPulso vista={vista} /><Banderas vista={vista} /></div>
  </section>;

  if (seccion === "dinero") return <section id="dinero" className="space-y-4">
    <h2 className="text-xl font-semibold">Dinero</h2>
    <div className={GRILLA}><VendidoYCaja vista={vista} hoy={hoy} /></div>
    <TablaPorPrograma titulo="Comisión y descuento por programa" vista={vista} seccion="dinero"
      cabeceras={["Comisión USD", "Sin comisión calculable", "Descuento promedio", "Descuento USD", "Ventas con descuento calculable"]}
      celdas={(fila) => <>
        <td className="text-right"><Button variant="link" nativeButton={false} render={<Enlace precarga="nunca" href={urlDeLista({ slug: fila.programa.slug, metrica: "contratado", periodo: vista.periodo, origen })} />}>{usd(fila.comision.valor)}</Button></td>
        <td className="text-right">{num(fila.dashboard.comision.ventasSinComision)}</td>
        <td className="text-right"><Button variant="link" nativeButton={false} render={<Enlace precarga="nunca" href={urlDeLista({ slug: fila.programa.slug, metrica: "contratado", periodo: vista.periodo, origen })} />}>{tasa(fila.descuento.valor)}</Button></td>
        <td className="text-right">{fila.dashboard.descuento.promedioUsd === null ? "—" : usd(fila.dashboard.descuento.promedioUsd)}</td>
        <td className="text-right">{num(fila.dashboard.descuento.ventas)}</td>
      </>} />
    <VentasPorCohorte vista={vista} origen={origen} />
  </section>;

  return <section id="comercial" className="space-y-4">
    <div><h2 className="text-xl font-semibold">Comercial</h2><p className="text-xs text-muted-foreground">{UNIVERSO_COMERCIAL}</p></div>
    <div className={GRILLA}><Conteos vista={vista} hoy={hoy} /></div>
    <TablaPorPrograma titulo="Tasas por programa" vista={vista} seccion="comercial"
      cabeceras={[nombreCorto("asistencia"), nombreCorto("cierre_de_ventas"), "% realizadas sin Grain"]}
      celdas={(fila) => {
        const tasas = tasasDe(fila, vista, hoy);
        return <>
        <td className="text-right"><Cifra tamano="celda" cifra={tasas.asistencia} /></td>
        <td className="text-right"><Cifra tamano="celda" cifra={tasas.cierreDeVentas} /></td>
        <td className="text-right">{tasa(fila.pctSinGrain.valor)}</td>
      </>;
      }} />
    {/* La escalera es una distribución: una tarjeta por programa, lado a lado, sin total ni % combinado (ADR 0048). */}
    <div className="grid gap-4 lg:grid-cols-2">
      {comercial?.escalera.map(({ programa, vista: escalera }) => (
        <Escalera key={programa.id} vista={escalera} periodo={vista.periodo} programa={programa.nombre} contexto={contextoDeCifra({ cohorte: null, rango: vista.periodo.a, hoy, closer: null })} />
      ))}
    </div>
    {comercial?.operaciones.map(({ fila, detalles, dealsContraAgendas, detallesOperacion }) => {
      // La sección compartida tiene un ancla fija; aquí hay una instancia por programa.
      const operacion = Operacion({
        vista: fila.dashboard, detalles, detallesOperacion, hoy, dealsContraAgendasVista: dealsContraAgendas,
        dealsContraAgendas: <DealsContraAgendas vista={dealsContraAgendas} />,
      });
      return <div key={fila.programa.id} className="space-y-3">
        <h3 className="text-lg font-semibold">{fila.programa.nombre}</h3>
        {cloneElement(operacion, { id: `operacion-${fila.programa.id}` })}
      </div>;
    })}
  </section>;
}
